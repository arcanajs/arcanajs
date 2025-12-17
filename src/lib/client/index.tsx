import React from "react";
import { hydrateRoot } from "react-dom/client";
import { HeadContext, HeadManager } from "../shared/context/HeadContext";
import { ArcanaJSApp } from "../shared/core/ArcanaJSApp";
import ErrorPage from "../shared/views/ErrorPage";
import NotFoundPage from "../shared/views/NotFoundPage";

/**
 * Navigation options for configuring ArcanaJS behavior
 */
interface NavigationOptions {
  /**
   * Callback function called after each successful navigation
   * Useful for analytics, logging, or custom scroll behavior
   */
  onNavigate?: (url: string) => void;
}

// ============================================================================
// Client Hydration Function
// ============================================================================

/**
 * Hydrate the ArcanaJS application on the client side
 *
 * This function initializes the React application on the client,
 * hydrating the server-rendered HTML with client-side interactivity.
 *
 * @param viewsOrContext - Either a views registry object or a webpack require.context
 * @param layout - Optional layout component to wrap all pages
 * @param options - Optional navigation configuration options
 *
 * @example
 * ```typescript
 * // With navigation options
 * import { hydrateArcanaJS } from 'arcanajs/client';
 *
 * // @ts-ignore
 * const views = require("arcanajs-views");
 *
 * hydrateArcanaJS(views, undefined, {
 *   onNavigate: (url) => {
 *     // Track page views
 *     gtag('event', 'page_view', { page_path: url });
 *   }
 * });
 * ```
 */
const hydrateArcanaJS = (
  viewsOrContext: Record<string, React.FC<any>> | any,
  layout?: React.FC<any>,
  options?: NavigationOptions
) => {
  let views: Record<string, React.FC<any>> = {};

  if (viewsOrContext.keys && typeof viewsOrContext.keys === "function") {
    viewsOrContext.keys().forEach((key: string) => {
      const viewName = key.replace(/^\.\/(.*)\.tsx$/, "$1");
      views[viewName] = viewsOrContext(key).default;
    });
  } else {
    views = viewsOrContext;
  }

  // Add default error views if not present
  if (!views["NotFoundPage"]) {
    views["NotFoundPage"] = NotFoundPage;
  }
  if (!views["ErrorPage"]) {
    views["ErrorPage"] = ErrorPage;
  }

  const container = document.getElementById("root");
  const dataScript = document.getElementById("__ARCANAJS_DATA__");

  // Client-side HeadManager (noop for push, as Head handles client updates via useEffect)
  const headManager: HeadManager = {
    tags: [],
    push: () => {},
  };

  if (container && dataScript) {
    try {
      const { page, data, params, csrfToken } = JSON.parse(
        dataScript.textContent || "{}"
      );
      hydrateRoot(
        container,
        <HeadContext.Provider value={headManager}>
          <ArcanaJSApp
            initialPage={page}
            initialData={data}
            initialParams={params}
            csrfToken={csrfToken}
            views={views}
            layout={layout}
            onNavigate={options?.onNavigate || (() => {})}
          />
        </HeadContext.Provider>
      );
    } catch (e) {
      console.error("Failed to parse initial data", e);
    }
  }
};
export default hydrateArcanaJS;
