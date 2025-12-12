import useFetch, { UseFetchOptions, UseFetchReturn } from "./useFetch";

/**
 * Options for useAsyncData hook
 */
export interface UseAsyncDataOptions<T> extends UseFetchOptions<T> {
  /** Lazy loading - don't fetch until execute() is called */
  lazy?: boolean;
  /** Pick specific keys from response */
  pick?: (keyof T)[];
  /** Server-side value for hydration */
  server?: boolean;
}

/**
 * Return type for useAsyncData hook
 */
export interface UseAsyncDataReturn<T> extends UseFetchReturn<T> {
  /** Whether data is from server hydration */
  isHydrated: boolean;
}

/**
 * useAsyncData - SSR-aware data fetching hook (Nuxt-style)
 *
 * This hook is designed for server-side rendering scenarios where
 * data can be pre-fetched on the server and hydrated on the client.
 *
 * Features:
 * - All features from useFetch
 * - Lazy loading option
 * - Pick specific fields to reduce payload
 * - SSR hydration support
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { data, pending } = useAsyncData<User>('/api/user');
 *
 * // Lazy loading
 * const { data, execute } = useAsyncData<Posts>('/api/posts', { lazy: true });
 *
 * // Pick specific fields
 * const { data } = useAsyncData<Profile>('/api/profile', {
 *   pick: ['name', 'email'],
 * });
 * ```
 */
function useAsyncData<T = any>(
  key: string,
  url: string | (() => string | null),
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataReturn<T> {
  const { lazy = false, pick, server = true, ...fetchOptions } = options;

  // Create a transform that picks specific keys
  const pickTransform = pick
    ? (data: T): T => {
        if (typeof data !== "object" || data === null) return data;
        const picked = {} as T;
        for (const k of pick) {
          if (k in (data as object)) {
            (picked as any)[k] = (data as any)[k];
          }
        }
        return picked;
      }
    : undefined;

  // Combine transforms if needed
  const transform = pickTransform
    ? (data: any) => {
        const result = fetchOptions.transform
          ? fetchOptions.transform(data)
          : data;
        return pickTransform(result);
      }
    : fetchOptions.transform;

  const fetchResult = useFetch<T>(url, {
    ...fetchOptions,
    key,
    immediate: !lazy,
    transform,
  });

  // Check if data was hydrated from server
  const isHydrated =
    typeof window !== "undefined" &&
    server &&
    fetchResult.data !== null &&
    fetchResult.status === "success" &&
    !fetchResult.pending;

  return {
    ...fetchResult,
    isHydrated,
  };
}

export default useAsyncData;
