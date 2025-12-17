import { useMemo } from "react";
import useRouter from "./useRouter";

/**
 * Match result from useRouteMatch
 */
export interface RouteMatchResult {
  /** Whether the pattern matched */
  matched: boolean;
  /** Extracted parameters from the pattern */
  params: Record<string, string>;
  /** The matched portion of the URL */
  matchedPath: string;
  /** Whether this is an exact match */
  isExact: boolean;
}

/**
 * Options for useRouteMatch
 */
export interface UseRouteMatchOptions {
  /**
   * Whether to require an exact match
   * Default: true
   */
  exact?: boolean;
  /**
   * Case-sensitive matching
   * Default: false
   */
  caseSensitive?: boolean;
}

/**
 * useRouteMatch - Pattern matching hook for routes
 *
 * Match the current URL against a pattern and extract parameters.
 * Useful for conditional rendering, active link styling, and route guards.
 *
 * @example
 * ```tsx
 * // Check if on a specific route
 * const match = useRouteMatch('/users/:id');
 * if (match.matched) {
 *   console.log(match.params.id); // '123'
 * }
 *
 * // Non-exact matching (prefix)
 * const dashboardMatch = useRouteMatch('/dashboard', { exact: false });
 * // Matches: /dashboard, /dashboard/settings, /dashboard/users/1
 *
 * // Use for active styling
 * const isActive = useRouteMatch('/products').matched;
 * <nav className={isActive ? 'active' : ''}>Products</nav>
 *
 * // Multiple patterns
 * const isAuthPage =
 *   useRouteMatch('/login').matched ||
 *   useRouteMatch('/register').matched;
 * ```
 */
function useRouteMatch(
  pattern: string,
  options: UseRouteMatchOptions = {}
): RouteMatchResult {
  const { exact = true, caseSensitive = false } = options;
  const { pathname } = useRouter();

  const result = useMemo((): RouteMatchResult => {
    const currentPath = caseSensitive ? pathname : pathname.toLowerCase();
    const matchPattern = caseSensitive ? pattern : pattern.toLowerCase();

    // Handle dynamic segments in pattern
    const patternParts = matchPattern.split("/").filter(Boolean);
    const pathParts = currentPath.split("/").filter(Boolean);

    // For non-exact matching, pattern should be prefix
    if (!exact && pathParts.length < patternParts.length) {
      return {
        matched: false,
        params: {},
        matchedPath: "",
        isExact: false,
      };
    }

    // For exact matching, lengths should be equal
    if (exact && pathParts.length !== patternParts.length) {
      return {
        matched: false,
        params: {},
        matchedPath: "",
        isExact: false,
      };
    }

    const params: Record<string, string> = {};
    const matchedParts: string[] = [];

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      // Dynamic segment
      if (patternPart.startsWith(":")) {
        const paramName = patternPart.slice(1);
        // Use original path part (not lowercased) for param value
        const originalPathParts = pathname.split("/").filter(Boolean);
        params[paramName] = originalPathParts[i];
        matchedParts.push(pathPart);
        continue;
      }

      // Catch-all segment
      if (
        patternPart === "*" ||
        (patternPart.startsWith(":") && patternPart.endsWith("*"))
      ) {
        const paramName =
          patternPart === "*" ? "wildcard" : patternPart.slice(1, -1);
        const originalPathParts = pathname.split("/").filter(Boolean);
        params[paramName] = originalPathParts.slice(i).join("/");
        matchedParts.push(...pathParts.slice(i));
        break;
      }

      // Static segment - must match
      if (patternPart !== pathPart) {
        return {
          matched: false,
          params: {},
          matchedPath: "",
          isExact: false,
        };
      }

      matchedParts.push(pathPart);
    }

    const matchedPath = "/" + matchedParts.join("/");
    const isExact = matchedPath === pathname || matchedPath === currentPath;

    return {
      matched: true,
      params,
      matchedPath,
      isExact,
    };
  }, [pathname, pattern, exact, caseSensitive]);

  return result;
}

/**
 * Simple boolean check if route matches
 *
 * @example
 * const isSettings = useRouteMatchCheck('/settings');
 */
export function useRouteMatchCheck(
  pattern: string,
  options: UseRouteMatchOptions = {}
): boolean {
  return useRouteMatch(pattern, options).matched;
}

export default useRouteMatch;
