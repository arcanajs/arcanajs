import { useContext, useMemo } from "react";
import {
  RequestContext,
  getClientRequestContext,
} from "../context/RequestContext";

/**
 * Return type for useRequest hook
 */
export interface UseRequestReturn {
  /** Request URL (full) */
  url: string;
  /** Request path */
  path: string;
  /** Query parameters */
  query: Record<string, string | string[] | undefined>;
  /** Request method */
  method: string;
  /** Client IP address (server only) */
  ip?: string;
  /** User agent */
  userAgent?: string;
  /** Whether this is server-side rendering */
  isSSR: boolean;
  /** Get a specific header */
  getHeader: (name: string) => string | undefined;
  /** Get a specific cookie */
  getCookie: (name: string) => string | undefined;
  /** Get a specific query parameter */
  getQuery: <T = string>(key: string) => T | undefined;
}

/**
 * useRequest - Access request information
 *
 * Provides access to the current request context including
 * URL, query parameters, headers, and cookies.
 *
 * On the server, this returns actual request data.
 * On the client, this returns browser-based equivalents.
 *
 * @example
 * ```tsx
 * const { path, query, getHeader, getCookie, isSSR } = useRequest();
 *
 * // Check if on server
 * if (isSSR) {
 *   const authHeader = getHeader('authorization');
 * }
 *
 * // Access query parameters
 * const page = query.page || '1';
 *
 * // Get cookie value
 * const theme = getCookie('theme') || 'light';
 * ```
 */
function useRequest(): UseRequestReturn {
  const context = useContext(RequestContext);

  // Use context if available, otherwise fall back to client context
  const requestData = useMemo(() => {
    if (context) {
      return context;
    }
    return getClientRequestContext();
  }, [context]);

  const getHeader = (name: string): string | undefined => {
    return requestData.headers[name.toLowerCase()];
  };

  const getCookie = (name: string): string | undefined => {
    return requestData.cookies[name];
  };

  const getQuery = <T = string>(key: string): T | undefined => {
    const value = requestData.query[key];
    if (value === undefined) return undefined;
    return (Array.isArray(value) ? value[0] : value) as unknown as T;
  };

  return {
    url: requestData.url,
    path: requestData.path,
    query: requestData.query,
    method: requestData.method,
    ip: requestData.ip,
    userAgent: requestData.userAgent,
    isSSR: requestData.isSSR,
    getHeader,
    getCookie,
    getQuery,
  };
}

export default useRequest;
