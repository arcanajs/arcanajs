import { useContext } from "react";
import { RouterContext } from "../context/RouterContext";

/**
 * useRouter - Access the ArcanaJS router context
 *
 * Provides navigation methods and current route state.
 *
 * @example
 * ```tsx
 * const { navigateTo, currentUrl, params, prefetch } = useRouter();
 *
 * // Navigate to a new page
 * navigateTo('/dashboard');
 *
 * // Navigate with async/await
 * await navigateToAsync?.('/settings');
 *
 * // Prefetch a route for faster navigation
 * prefetch('/about');
 *
 * // Check if currently navigating
 * if (isNavigating) {
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
    navigateTo: context.navigateTo,
    navigateToAsync: context.navigateToAsync,
    prefetch: context.prefetchRoute,
    prefetchRoute: context.prefetchRoute,
    currentPage: context.currentPage,
    currentUrl: context.currentUrl,
    params: context.params,
    csrfToken: context.csrfToken,
    onNavigate: context.onNavigate,
    isNavigating: context.isNavigating,
  };
};

export default useRouter;
