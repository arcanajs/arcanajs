import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NavigateOptions,
  parseQueryString,
  RouterProvider,
} from "../context/RouterContext";
import { isRedirectError, setClientNavigate } from "../utils/redirect";
import PageProvider from "./PageProvider";

/**
 * Scroll restoration behavior
 */
export type ScrollRestoration = "auto" | "manual" | "none";

/**
 * Navigation guard callback
 * Return false to prevent navigation
 */
export type BeforeNavigateCallback = (
  to: string,
  from: string
) => boolean | Promise<boolean>;

/**
 * After navigation callback
 */
export type AfterNavigateCallback = (to: string, from: string) => void;

export interface ArcanaJSAppProps<
  TData = any,
  TParams extends Record<string, string> = Record<string, string>
> {
  initialPage: string;
  initialData: TData;
  initialParams?: TParams;
  initialUrl?: string;
  csrfToken?: string;
  views: Record<
    string,
    React.ComponentType<{
      data: TData;
      navigateTo: (url: string) => Promise<void>;
      params: TParams;
    }>
  >;
  layout?: React.FC<{ children: React.ReactNode }>;
  onNavigate?: (url: string) => void;
  /** Maximum number of entries to keep in the navigation cache */
  cacheLimit?: number;

  // ============================================================================
  // New Pro Features
  // ============================================================================

  /**
   * Scroll restoration behavior
   * - 'auto': Restore scroll position on back/forward, scroll to top on new navigation
   * - 'manual': User controls scroll behavior
   * - 'none': No automatic scroll handling
   */
  scrollRestoration?: ScrollRestoration;

  /**
   * Navigation guard - called before navigation
   * Return false to prevent navigation
   */
  beforeNavigate?: BeforeNavigateCallback;

  /**
   * Callback after navigation completes
   */
  afterNavigate?: AfterNavigateCallback;
}

export const ArcanaJSApp = <
  TData = any,
  TParams extends Record<string, string> = Record<string, string>
>(
  props: ArcanaJSAppProps<TData, TParams>
) => {
  const {
    initialPage,
    initialData,
    initialParams = {} as TParams,
    initialUrl,
    csrfToken,
    views,
    layout: Layout,
    onNavigate,
    cacheLimit = 50,
    scrollRestoration = "auto",
    beforeNavigate,
    afterNavigate,
  } = props;

  const [page, setPage] = useState<string>(initialPage);
  const [data, setData] = useState<TData>(initialData);
  const [params, setParams] = useState<TParams>(initialParams);
  const [url, setUrl] = useState<string>(
    initialUrl ||
      (typeof window !== "undefined" ? window.location.pathname : "/")
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationState, setNavigationState] = useState<any>(undefined);
  const [previousUrl, setPreviousUrl] = useState<string | undefined>(undefined);

  // Navigation cache to store previously visited pages (LRU via Map ordering)
  const navigationCache = useRef(
    new Map<string, { page: string; data: TData; params: TParams }>()
  );

  // Scroll position storage for scroll restoration
  const scrollPositions = useRef(new Map<string, { x: number; y: number }>());

  // Track prefetch in-flight to avoid duplicate requests
  const prefetchInFlight = useRef(new Set<string>());

  // Abort controller for in-flight navigation fetch
  const currentAbort = useRef<AbortController | null>(null);

  // Save scroll position before navigation
  const saveScrollPosition = useCallback(() => {
    if (typeof window !== "undefined" && scrollRestoration !== "none") {
      scrollPositions.current.set(url, {
        x: window.scrollX,
        y: window.scrollY,
      });
    }
  }, [url, scrollRestoration]);

  // Restore scroll position or scroll to top
  const handleScroll = useCallback(
    (targetUrl: string, isRestore: boolean, options?: NavigateOptions) => {
      if (typeof window === "undefined" || scrollRestoration === "none") return;
      if (options?.scroll === false) return;

      setTimeout(() => {
        if (isRestore && scrollRestoration === "auto") {
          const saved = scrollPositions.current.get(targetUrl);
          if (saved) {
            window.scrollTo({
              left: saved.x,
              top: saved.y,
              behavior: "instant",
            });
            return;
          }
        }

        if (scrollRestoration === "auto") {
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch {
            window.scrollTo(0, 0);
          }
        }
      }, 0);
    },
    [scrollRestoration]
  );

  // Core navigation function
  const navigateTo = useCallback(
    async (newUrl: string, options: NavigateOptions = {}): Promise<void> => {
      const {
        replace = false,
        state,
        shallow = false,
        scroll = true,
      } = options;

      // Run before navigation guard
      if (beforeNavigate) {
        try {
          const shouldProceed = await beforeNavigate(newUrl, url);
          if (!shouldProceed) {
            return;
          }
        } catch (error) {
          console.error("beforeNavigate error:", error);
          return;
        }
      }

      // Save current scroll position
      saveScrollPosition();

      // Store previous URL
      setPreviousUrl(url);

      // Shallow navigation - just update URL without fetching
      if (shallow) {
        setUrl(newUrl);
        setNavigationState(state);

        if (replace) {
          window.history.replaceState(
            { page, data, params, state },
            "",
            newUrl
          );
        } else {
          window.history.pushState({ page, data, params, state }, "", newUrl);
        }

        if (afterNavigate) afterNavigate(newUrl, url);
        if (onNavigate) onNavigate(newUrl);
        return;
      }

      // Check cache first for instant navigation
      const map = navigationCache.current;
      if (map.has(newUrl)) {
        const cached = map.get(newUrl)!;
        setPage(cached.page);
        setData(cached.data);
        setParams(cached.params || ({} as TParams));
        setUrl(newUrl);
        setNavigationState(state);

        const historyState = { ...cached, state };
        if (replace) {
          window.history.replaceState(historyState, "", newUrl);
        } else {
          window.history.pushState(historyState, "", newUrl);
        }

        handleScroll(newUrl, false, { scroll });

        if (afterNavigate) afterNavigate(newUrl, url);
        if (onNavigate) onNavigate(newUrl);
        return;
      }

      setIsNavigating(true);

      // Abort previous request
      currentAbort.current?.abort();
      const controller = new AbortController();
      currentAbort.current = controller;

      try {
        const response = await fetch(newUrl, {
          headers: { "X-ArcanaJS-Request": "true" },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            setPage("NotFoundPage");
            setUrl(newUrl);
            const historyState = { page: "NotFoundPage", data: {} };
            if (replace) {
              window.history.replaceState(historyState, "", newUrl);
            } else {
              window.history.pushState(historyState, "", newUrl);
            }
            return;
          }
          throw new Error(
            `Navigation failed: ${response.status} ${response.statusText}`
          );
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          window.location.href = newUrl;
          return;
        }

        const json = await response.json();

        // Handle redirect response from server
        if (json.redirect) {
          await navigateTo(json.url, { replace: true });
          return;
        }

        const payload = {
          page: json.page as string,
          data: json.data as TData,
          params: (json.params || {}) as TParams,
        };
        setCache(newUrl, payload);

        const historyState = { ...payload, state };
        if (replace) {
          window.history.replaceState(historyState, "", newUrl);
        } else {
          window.history.pushState(historyState, "", newUrl);
        }

        setPage(payload.page);
        setData(payload.data);
        setParams(payload.params || ({} as TParams));
        setUrl(newUrl);
        setNavigationState(state);

        handleScroll(newUrl, false, { scroll });

        if (afterNavigate) afterNavigate(newUrl, url);
        if (onNavigate) onNavigate(newUrl);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        if (isRedirectError(err)) return;
        console.error("Navigation failed", err);
        throw err;
      } finally {
        if (currentAbort.current === controller) currentAbort.current = null;
        setIsNavigating(false);
      }
    },
    [
      url,
      page,
      data,
      params,
      onNavigate,
      beforeNavigate,
      afterNavigate,
      saveScrollPosition,
      handleScroll,
    ]
  );

  // Set client navigate for universal redirect
  useEffect(() => {
    setClientNavigate((targetUrl, options) => {
      void navigateTo(targetUrl, { replace: options?.replace });
    });

    return () => {
      setClientNavigate(null);
    };
  }, [navigateTo]);

  // Initialize history state and popstate handler
  useEffect(() => {
    if (typeof window !== "undefined" && !window.history.state) {
      window.history.replaceState(
        { page: initialPage, data: initialData, params: initialParams },
        "",
        window.location.href
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        saveScrollPosition();
        setPage(event.state.page);
        setData(event.state.data);
        setParams(event.state.params || ({} as TParams));
        setNavigationState(event.state.state);
        const newUrl = window.location.pathname;
        setPreviousUrl(url);
        setUrl(newUrl);

        handleScroll(newUrl, true);

        if (afterNavigate) afterNavigate(newUrl, url);
      } else {
        const path = window.location.pathname;
        void navigateTo(path).catch(() => {
          window.location.reload();
        });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      currentAbort.current?.abort();
    };
  }, []);

  const setCache = useCallback(
    (key: string, value: { page: string; data: TData; params: TParams }) => {
      const map = navigationCache.current;
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > cacheLimit) {
        const firstKey = map.keys().next().value;
        if (firstKey !== undefined) map.delete(firstKey);
      }
    },
    [cacheLimit]
  );

  /**
   * Prefetch a route to warm the navigation cache
   */
  const prefetchRoute = useCallback(
    async (prefetchUrl: string): Promise<void> => {
      if (navigationCache.current.has(prefetchUrl)) return;
      if (prefetchInFlight.current.has(prefetchUrl)) return;
      if (/^https?:\/\//.test(prefetchUrl)) return;

      prefetchInFlight.current.add(prefetchUrl);

      try {
        const response = await fetch(prefetchUrl, {
          headers: { "X-ArcanaJS-Request": "true" },
        });

        if (!response.ok) return;

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;

        const json = await response.json();

        const payload = {
          page: json.page as string,
          data: json.data as TData,
          params: (json.params || {}) as TParams,
        };

        setCache(prefetchUrl, payload);
      } catch {
        // Silently ignore prefetch errors
      } finally {
        prefetchInFlight.current.delete(prefetchUrl);
      }
    },
    [setCache]
  );

  /**
   * Refresh current page data
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Clear cache for current URL
    navigationCache.current.delete(url);
    // Re-navigate to current URL with replace
    await navigateTo(url, { replace: true, scroll: false });
  }, [url, navigateTo]);

  /**
   * Replace current history entry
   */
  const replace = useCallback(
    (newUrl: string, options: Omit<NavigateOptions, "replace"> = {}) => {
      void navigateTo(newUrl, { ...options, replace: true });
    },
    [navigateTo]
  );

  /**
   * Go back in history
   */
  const back = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  }, []);

  /**
   * Go forward in history
   */
  const forward = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.forward();
    }
  }, []);

  // Parse current query string
  const query = useMemo(() => {
    if (typeof window === "undefined") return {};
    return parseQueryString(window.location.search);
  }, [url]);

  // Memoize renderPage to prevent unnecessary re-renders
  const content = useMemo(() => {
    const Component = (views[page] ||
      views["NotFoundPage"] ||
      (() => <div>404 Not Found</div>)) as React.ComponentType<{
      data: TData;
      navigateTo: (url: string) => Promise<void>;
      params: TParams;
    }>;

    return (
      <PageProvider data={data}>
        <Component data={data} navigateTo={navigateTo} params={params} />
      </PageProvider>
    );
  }, [page, data, params, views, navigateTo]);

  // Memoize router context value
  const routerValue = useMemo(
    () => ({
      // Navigation methods
      navigateTo: (targetUrl: string, options?: NavigateOptions) => {
        void navigateTo(targetUrl, options);
      },
      navigateToAsync: navigateTo,
      push: (targetUrl: string, options?: NavigateOptions) => {
        void navigateTo(targetUrl, options);
      },
      replace,
      back,
      forward,
      refresh,
      prefetchRoute,

      // Current route state
      currentPage: page,
      currentUrl: url,
      pathname: url,
      params,
      query,
      state: navigationState,

      // Authentication
      csrfToken,

      // Navigation state
      isNavigating,
      onNavigate,
      previousUrl,
    }),
    [
      navigateTo,
      replace,
      back,
      forward,
      refresh,
      prefetchRoute,
      page,
      url,
      params,
      query,
      navigationState,
      csrfToken,
      isNavigating,
      onNavigate,
      previousUrl,
    ]
  );

  return (
    <RouterProvider value={routerValue}>
      {Layout ? <Layout>{content}</Layout> : <>{content}</>}
    </RouterProvider>
  );
};
