import { useContext } from "react";
import { RouterContext } from "../context/RouterContext";

/**
 * useRouter - Professional routing hook for ArcanaJS
 *
 * Provides complete navigation methods and current route state.
 * Works in both SSR and client-side contexts.
 *
 * @example
 * ```tsx
 * const router = useRouter();
 *
 * // Push navigation
 * router.push('/dashboard');
 *
 * // Replace current entry
 * router.replace('/settings');
 *
 * // Navigation with options
 * router.push('/page', { scroll: false, state: { from: 'home' } });
 *
 * // Go back/forward
 * router.back();
 * router.forward();
 *
 * // Refresh current page data
 * await router.refresh();
 *
 * // Prefetch a route
 * router.prefetch('/about');
 *
 * // Access route info
 * console.log(router.pathname);   // '/users/123'
 * console.log(router.params);     // { id: '123' }
 * console.log(router.query);      // { sort: 'asc' }
 * console.log(router.state);      // { from: 'home' }
 *
 * // Check navigation state
 * if (router.isNavigating) {
 *   return <Spinner />;
 * }
 * ```
 */
const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within an ArcanaJSApp");
  }

  return {
    // ============================================================================
    // Navigation Methods
    // ============================================================================

    /** Navigate to a URL (fire-and-forget) */
    navigateTo: context.navigateTo,

    /** Navigate to a URL with async/await */
    navigateToAsync: context.navigateToAsync,

    /** Push a new entry to history (alias for navigateTo) */
    push: context.push,

    /** Replace current history entry with new URL */
    replace: context.replace,

    /** Go back in history */
    back: context.back,

    /** Go forward in history */
    forward: context.forward,

    /** Refresh current page data */
    refresh: context.refresh,

    /** Prefetch a route for faster navigation */
    prefetch: context.prefetchRoute,
    prefetchRoute: context.prefetchRoute,

    // ============================================================================
    // Current Route State
    // ============================================================================

    /** Current page/view name */
    currentPage: context.currentPage,

    /** Current URL path */
    currentUrl: context.currentUrl,

    /** Current pathname (alias for currentUrl) */
    pathname: context.pathname,

    /** Dynamic route parameters */
    params: context.params,

    /** Parsed query string parameters */
    query: context.query,

    /** Navigation state passed via options */
    state: context.state,

    /** Previous URL before navigation */
    previousUrl: context.previousUrl,

    // ============================================================================
    // Authentication
    // ============================================================================

    /** CSRF token for form submissions */
    csrfToken: context.csrfToken,

    // ============================================================================
    // Navigation State
    // ============================================================================

    /** Whether navigation is in progress */
    isNavigating: context.isNavigating,

    /** Callback when navigation completes */
    onNavigate: context.onNavigate,
  };
};

/**
 * Return type for useRouter hook
 */
export type UseRouterReturn = ReturnType<typeof useRouter>;

export default useRouter;
