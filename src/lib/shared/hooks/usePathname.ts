import useRouter from "./useRouter";

/**
 * usePathname - Simple pathname accessor hook
 *
 * Returns the current URL pathname without query string or hash.
 * SSR-safe - returns "/" on the server.
 *
 * @example
 * ```tsx
 * const pathname = usePathname();
 * // Returns: '/products/123'
 *
 * // Use in conditional rendering
 * if (pathname === '/about') {
 *   return <AboutHighlight />;
 * }
 *
 * // Use in effects
 * useEffect(() => {
 *   trackPageView(pathname);
 * }, [pathname]);
 * ```
 */
function usePathname(): string {
  const { pathname } = useRouter();
  return pathname;
}

export default usePathname;
