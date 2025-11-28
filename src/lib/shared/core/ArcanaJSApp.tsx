import React, { useEffect, useState } from "react";
import { Page } from "../components/Page";
import { RouterProvider } from "../context/RouterContext";

export interface ArcanaJSAppProps {
  initialPage: string;
  initialData: any;
  initialParams?: Record<string, string>;
  initialUrl?: string;
  csrfToken?: string;
  views: Record<string, React.FC<any>>;
  layout?: React.FC<{ children: React.ReactNode }>;
  onNavigate?: (url: string) => void;
}

export const ArcanaJSApp: React.FC<ArcanaJSAppProps> = ({
  initialPage,
  initialData,
  initialParams = {},
  initialUrl,
  csrfToken,
  views,
  layout: Layout,
  onNavigate,
}) => {
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState(initialData);
  const [params, setParams] = useState(initialParams);
  const [url, setUrl] = useState(
    initialUrl ||
      (typeof window !== "undefined" ? window.location.pathname : "/")
  );
  const [isNavigating, setIsNavigating] = useState(false);

  // Navigation cache to store previously visited pages
  const navigationCache = React.useRef(
    new Map<string, { page: string; data: any; params: any }>()
  );

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
        setParams(event.state.params || {});
        setUrl(window.location.pathname);
      } else {
        window.location.reload();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = async (newUrl: string) => {
    // Check cache first for instant navigation
    if (navigationCache.current.has(newUrl)) {
      const cached = navigationCache.current.get(newUrl)!;
      setPage(cached.page);
      setData(cached.data);
      setParams(cached.params || {});
      setUrl(newUrl);
      window.history.pushState(cached, "", newUrl);

      // Scroll to top
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (onNavigate) {
        onNavigate(newUrl);
      }
      return;
    }

    setIsNavigating(true);
    try {
      const response = await fetch(newUrl, {
        headers: { "X-ArcanaJS-Request": "true" },
        // prevent caching in dev navigation
        cache: "no-store",
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

      // Ensure server returned JSON. If not, fallback to full navigation reload
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // The server returned HTML (or something else) instead of JSON.
        // Do a full reload so the browser displays the correct page instead
        // of trying to parse HTML as JSON (which causes the SyntaxError).
        window.location.href = newUrl;
        return;
      }

      const json = await response.json();

      // Cache the navigation result
      navigationCache.current.set(newUrl, {
        page: json.page,
        data: json.data,
        params: json.params,
      });

      window.history.pushState(
        { page: json.page, data: json.data, params: json.params },
        "",
        newUrl
      );

      setPage(json.page);
      setData(json.data);
      setParams(json.params || {});
      setUrl(newUrl);

      // Scroll to top after navigation
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (onNavigate) {
        onNavigate(newUrl);
      }
    } catch (error) {
      console.error("Navigation failed", error);
    } finally {
      setIsNavigating(false);
    }
  };

  const renderPage = () => {
    const Component =
      views[page] || views["NotFoundPage"] || (() => <div>404 Not Found</div>);
    return (
      <Page data={data}>
        {/* @ts-ignore */}
        <Component data={data} navigateTo={navigateTo} params={params} />
      </Page>
    );
  };

  const content = renderPage();

  return (
    <RouterProvider
      value={{
        navigateTo,
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
