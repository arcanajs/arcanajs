import { useCallback, useMemo } from "react";
import { serializeQueryString } from "../context/RouterContext";
import useRouter from "./useRouter";

/**
 * Setter function type for search params
 */
export type SetSearchParamsFunction = (
  newParams:
    | Record<string, string | string[] | undefined>
    | ((prev: URLSearchParams) => Record<string, string | string[] | undefined>)
) => void;

/**
 * Options for setSearchParams
 */
export interface SetSearchParamsOptions {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** Scroll to top after navigation */
  scroll?: boolean;
}

/**
 * Return type for useSearchParams hook
 */
export interface UseSearchParamsReturn {
  /** Current URLSearchParams object */
  searchParams: URLSearchParams;
  /** Update search params */
  setSearchParams: (
    newParams:
      | Record<string, string | string[] | undefined>
      | ((
          prev: URLSearchParams
        ) => Record<string, string | string[] | undefined>),
    options?: SetSearchParamsOptions
  ) => void;
  /** Get a single param value */
  get: (key: string) => string | null;
  /** Get all values for a param */
  getAll: (key: string) => string[];
  /** Check if param exists */
  has: (key: string) => boolean;
  /** Get params as object */
  toObject: () => Record<string, string | string[]>;
}

/**
 * useSearchParams - Professional query parameter management
 *
 * Provides a React-friendly way to read and update URL search parameters.
 * to useSearchParams but with setter functionality.
 *
 * @example
 * ```tsx
 * const { searchParams, setSearchParams, get } = useSearchParams();
 *
 * // Read params
 * const sort = get('sort');           // 'asc'
 * const filters = getAll('filter');   // ['active', 'new']
 *
 * // Update params (pushes new history entry)
 * setSearchParams({ sort: 'desc', page: '2' });
 *
 * // Merge with existing params
 * setSearchParams(prev => ({
 *   ...Object.fromEntries(prev),
 *   filter: 'active'
 * }));
 *
 * // Replace instead of push
 * setSearchParams({ tab: 'settings' }, { replace: true });
 *
 * // Remove a param by setting to undefined
 * setSearchParams({ sort: undefined });
 * ```
 */
function useSearchParams(): UseSearchParamsReturn {
  const router = useRouter();

  // Create URLSearchParams from current URL
  const searchParams = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, [router.currentUrl]);

  // Set search params with navigation
  const setSearchParams = useCallback(
    (
      newParams:
        | Record<string, string | string[] | undefined>
        | ((
            prev: URLSearchParams
          ) => Record<string, string | string[] | undefined>),
      options: SetSearchParamsOptions = {}
    ) => {
      const { replace = false, scroll = false } = options;

      // Resolve the new params
      const resolved =
        typeof newParams === "function" ? newParams(searchParams) : newParams;

      // Build new query string
      const queryString = serializeQueryString(resolved);
      const newUrl = router.pathname + queryString;

      // Navigate with shallow update
      if (replace) {
        router.replace(newUrl, { scroll, shallow: true });
      } else {
        router.push(newUrl, { scroll, shallow: true });
      }
    },
    [searchParams, router]
  );

  // Get single value
  const get = useCallback(
    (key: string): string | null => searchParams.get(key),
    [searchParams]
  );

  // Get all values
  const getAll = useCallback(
    (key: string): string[] => searchParams.getAll(key),
    [searchParams]
  );

  // Check if exists
  const has = useCallback(
    (key: string): boolean => searchParams.has(key),
    [searchParams]
  );

  // Convert to object
  const toObject = useCallback((): Record<string, string | string[]> => {
    const obj: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      const existing = obj[key];
      if (existing === undefined) {
        obj[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        obj[key] = [existing, value];
      }
    });
    return obj;
  }, [searchParams]);

  return {
    searchParams,
    setSearchParams,
    get,
    getAll,
    has,
    toObject,
  };
}

export default useSearchParams;
