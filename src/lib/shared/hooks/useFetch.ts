import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetch status type
 */
export type FetchStatus = "idle" | "pending" | "success" | "error";

/**
 * Options for useFetch hook
 */
export interface UseFetchOptions<T> {
  /** Unique cache key for deduplication */
  key?: string;
  /** Fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Dependencies to trigger refetch */
  watch?: any[];
  /** Default value before fetch completes */
  default?: T;
  /** Transform response data */
  transform?: (data: any) => T;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Success callback */
  onSuccess?: (data: T) => void;
  /** Number of retries on failure (default: 0) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Deduplicate concurrent requests (default: true) */
  dedupe?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request method (default: GET) */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Request body for POST/PUT/PATCH */
  body?: any;
  /** Cache time in ms (default: 0 - no cache) */
  cacheTime?: number;
  /** Stale time in ms - refetch in background after this time */
  staleTime?: number;
  /** Refetch on window focus (default: false) */
  refetchOnFocus?: boolean;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Return type for useFetch hook
 */
export interface UseFetchReturn<T> {
  /** Fetched data */
  data: T | null;
  /** Loading state */
  pending: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Current fetch status */
  status: FetchStatus;
  /** Refresh/refetch data */
  refresh: () => Promise<void>;
  /** Execute fetch (alias for refresh) */
  execute: () => Promise<void>;
  /** Clear data and error */
  clear: () => void;
  /** Abort current request */
  abort: () => void;
}

// Global cache for fetch results
const fetchCache = new Map<
  string,
  { data: any; timestamp: number; staleAt: number }
>();

// Global in-flight requests for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * useFetch - Professional data fetching hook 
 *
 * Features:
 * - Automatic caching with configurable TTL
 * - Loading/error/success states
 * - Abort on unmount to prevent memory leaks
 * - Automatic retries with exponential backoff
 * - Request deduplication
 * - Stale-while-revalidate pattern
 * - Refetch on focus/interval
 *
 * @example
 * ```tsx
 * const { data, pending, error, refresh } = useFetch<User[]>('/api/users');
 *
 * // With options
 * const { data } = useFetch<Post>('/api/posts/1', {
 *   transform: (data) => data.post,
 *   retries: 3,
 *   cacheTime: 60000, // 1 minute
 * });
 * ```
 */
function useFetch<T = any>(
  url: string | (() => string | null),
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const {
    key,
    immediate = true,
    watch = [],
    default: defaultValue,
    transform,
    onError,
    onSuccess,
    retries = 0,
    retryDelay = 1000,
    dedupe = true,
    timeout,
    headers = {},
    method = "GET",
    body,
    cacheTime = 0,
    staleTime,
    refetchOnFocus = false,
    refetchInterval,
  } = options;

  const [data, setData] = useState<T | null>(defaultValue ?? null);
  const [pending, setPending] = useState<boolean>(immediate);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<FetchStatus>(
    immediate ? "pending" : "idle"
  );

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef<boolean>(true);
  const retryCountRef = useRef<number>(0);

  // Resolve URL (supports getter function)
  const resolveUrl = useCallback((): string | null => {
    if (typeof url === "function") {
      return url();
    }
    return url;
  }, [url]);

  // Get cache key
  const getCacheKey = useCallback((): string => {
    const resolvedUrl = resolveUrl();
    if (key) return key;
    if (!resolvedUrl) return "";
    return `${method}:${resolvedUrl}:${JSON.stringify(body || {})}`;
  }, [key, resolveUrl, method, body]);

  // Check cache
  const getFromCache = useCallback((): {
    data: T;
    isStale: boolean;
  } | null => {
    if (cacheTime <= 0) return null;

    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    const cached = fetchCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cacheTime) {
      fetchCache.delete(cacheKey);
      return null;
    }

    const isStale = staleTime ? now > cached.staleAt : false;
    return { data: cached.data, isStale };
  }, [cacheTime, getCacheKey, staleTime]);

  // Set cache
  const setToCache = useCallback(
    (data: T): void => {
      if (cacheTime <= 0) return;

      const cacheKey = getCacheKey();
      if (!cacheKey) return;

      fetchCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        staleAt: staleTime ? Date.now() + staleTime : Infinity,
      });
    },
    [cacheTime, getCacheKey, staleTime]
  );

  // Execute fetch
  const execute = useCallback(async (): Promise<void> => {
    const resolvedUrl = resolveUrl();
    if (!resolvedUrl) {
      setStatus("idle");
      setPending(false);
      return;
    }

    // Check cache first
    const cached = getFromCache();
    if (cached) {
      setData(cached.data);
      setStatus("success");
      setPending(false);
      setError(null);

      // If stale, refetch in background
      if (!cached.isStale) {
        return;
      }
    }

    const cacheKey = getCacheKey();

    // Deduplicate concurrent requests
    if (dedupe && cacheKey && inFlightRequests.has(cacheKey)) {
      try {
        const result = await inFlightRequests.get(cacheKey);
        if (mountedRef.current) {
          const transformedData = transform ? transform(result) : result;
          setData(transformedData);
          setStatus("success");
          setPending(false);
          setError(null);
        }
        return;
      } catch (err) {
        // Let it fall through to make its own request
      }
    }

    // Abort previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    if (!cached) {
      setPending(true);
      setStatus("pending");
    }

    const fetchWithRetry = async (attemptCount: number): Promise<T> => {
      try {
        const controller = abortControllerRef.current!;

        // Setup timeout
        let timeoutId: NodeJS.Timeout | undefined;
        if (timeout) {
          timeoutId = setTimeout(() => controller.abort(), timeout);
        }

        const response = await fetch(resolvedUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} ${response.statusText}`
          );
        }

        const contentType = response.headers.get("content-type") || "";
        let result: any;

        if (contentType.includes("application/json")) {
          result = await response.json();
        } else {
          result = await response.text();
        }

        return transform ? transform(result) : result;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw err;
        }

        // Retry logic with exponential backoff
        if (attemptCount < retries) {
          const delay = retryDelay * Math.pow(2, attemptCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retryCountRef.current = attemptCount + 1;
          return fetchWithRetry(attemptCount + 1);
        }

        throw err;
      }
    };

    const fetchPromise = fetchWithRetry(0);

    // Store for deduplication
    if (dedupe && cacheKey) {
      inFlightRequests.set(cacheKey, fetchPromise);
    }

    try {
      const result = await fetchPromise;

      if (mountedRef.current) {
        setData(result);
        setStatus("success");
        setError(null);
        setToCache(result);
        onSuccess?.(result);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return;
      }

      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStatus("error");
        onError?.(error);
      }
    } finally {
      if (dedupe && cacheKey) {
        inFlightRequests.delete(cacheKey);
      }

      if (mountedRef.current) {
        setPending(false);
        retryCountRef.current = 0;
      }
    }
  }, [
    resolveUrl,
    getFromCache,
    getCacheKey,
    dedupe,
    transform,
    timeout,
    method,
    headers,
    body,
    retries,
    retryDelay,
    setToCache,
    onSuccess,
    onError,
  ]);

  // Clear data and error
  const clear = useCallback((): void => {
    setData(defaultValue ?? null);
    setError(null);
    setStatus("idle");
  }, [defaultValue]);

  // Abort current request
  const abort = useCallback((): void => {
    abortControllerRef.current?.abort();
    setPending(false);
    setStatus("idle");
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (typeof window === "undefined") {
      // SSR: skip fetch on server
      return;
    }

    if (immediate) {
      execute();
    }

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch dependencies for refetch
  useEffect(() => {
    if (!immediate || watch.length === 0) return;
    if (typeof window === "undefined") return;

    execute();
  }, watch); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus || typeof window === "undefined") return;

    const handleFocus = () => {
      const cached = getFromCache();
      if (!cached || cached.isStale) {
        execute();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnFocus, execute, getFromCache]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || typeof window === "undefined") return;

    const intervalId = setInterval(execute, refetchInterval);
    return () => clearInterval(intervalId);
  }, [refetchInterval, execute]);

  return {
    data,
    pending,
    error,
    status,
    refresh: execute,
    execute,
    clear,
    abort,
  };
}

export default useFetch;
