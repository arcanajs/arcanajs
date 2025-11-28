import React, { useEffect, useState } from "react";
import { Page } from "../components/Page";
import { RouterProvider } from "../context/RouterContext";

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
  } = props;

  const [page, setPage] = useState<string>(initialPage);
  const [data, setData] = useState<TData>(initialData);
  const [params, setParams] = useState<TParams>(initialParams);
  const [url, setUrl] = useState<string>(
    initialUrl ||
      (typeof window !== "undefined" ? window.location.pathname : "/")
  );
  const [isNavigating, setIsNavigating] = useState(false);

  // Navigation cache to store previously visited pages (LRU via Map ordering)
  const navigationCache = React.useRef(
    new Map<string, { page: string; data: TData; params: TParams }>()
  );

  // Abort controller for in-flight navigation fetch
  const currentAbort = React.useRef<AbortController | null>(null);

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
        setPage(event.state.page);
        setData(event.state.data);
        setParams(event.state.params || ({} as TParams));
        setUrl(window.location.pathname);
      } else {
        // Try to fetch the page state instead of hard reload
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

  const setCache = (
    key: string,
    value: { page: string; data: TData; params: TParams }
  ) => {
    const map = navigationCache.current;
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    if (map.size > cacheLimit) {
      const firstKey = map.keys().next().value;
      if (firstKey !== undefined) map.delete(firstKey);
    }
  };

  const navigateTo = async (newUrl: string): Promise<void> => {
    // Check cache first for instant navigation
    const map = navigationCache.current;
    if (map.has(newUrl)) {
      const cached = map.get(newUrl)!;
      setPage(cached.page);
      setData(cached.data);
      setParams(cached.params || ({} as TParams));
      setUrl(newUrl);
      window.history.pushState(cached, "", newUrl);

      if (typeof window !== "undefined") {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
          // ignore in non-browser env or when smooth not supported
        }
      }

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
          window.history.pushState(
            { page: "NotFoundPage", data: {} },
            "",
            newUrl
          );
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

      const payload = {
        page: json.page as string,
        data: json.data as TData,
        params: (json.params || {}) as TParams,
      };
      setCache(newUrl, payload);

      window.history.pushState(
        { page: payload.page, data: payload.data, params: payload.params },
        "",
        newUrl
      );

      setPage(payload.page);
      setData(payload.data);
      setParams(payload.params || ({} as TParams));
      setUrl(newUrl);

      if (typeof window !== "undefined") {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
          // ignore
        }
      }

      if (onNavigate) onNavigate(newUrl);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Navigation failed", err);
      throw err;
    } finally {
      // Clear abort controller if it's still the one we set
      if (currentAbort.current === controller) currentAbort.current = null;
      setIsNavigating(false);
    }
  };

  const renderPage = () => {
    const Component = (views[page] ||
      views["NotFoundPage"] ||
      (() => <div>404 Not Found</div>)) as React.ComponentType<{
      data: TData;
      navigateTo: (url: string) => Promise<void>;
      params: TParams;
    }>;

    return (
      <Page data={data}>
        <Component data={data} navigateTo={navigateTo} params={params} />
      </Page>
    );
  };

  const content = renderPage();

  return (
    <RouterProvider
      value={{
        // keep backward-compatible wrapper that doesn't return a promise
        navigateTo: (...args: any[]) => {
          void navigateTo(args[0]);
        },
        // new async API consumers can use `navigateToAsync` when available
        navigateToAsync: navigateTo,
        currentPage: page,
        currentUrl: url,
        params,
        csrfToken,
        onNavigate,
        isNavigating,
      }}
    >
      {Layout ? <Layout>{content}</Layout> : <>{content}</>}
    </RouterProvider>
  );
};
