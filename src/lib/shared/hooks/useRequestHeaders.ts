import { useContext } from "react";
import { RequestContext } from "../context/RequestContext";

/**
 * Common request header names for type safety
 */
export type CommonHeaderName =
  | "accept"
  | "accept-language"
  | "accept-encoding"
  | "authorization"
  | "cache-control"
  | "content-type"
  | "cookie"
  | "host"
  | "origin"
  | "referer"
  | "user-agent"
  | "x-forwarded-for"
  | "x-forwarded-host"
  | "x-forwarded-proto"
  | "x-real-ip"
  | "x-requested-with"
  | (string & {});

/**
 * useRequestHeaders - Access request headers
 *
 * On the server, returns actual request headers from the incoming request.
 * On the client, returns an empty object (headers are not available).
 *
 * This is useful for SSR scenarios where you need to forward headers
 * for authentication, locale detection, etc.
 *
 * @example
 * ```tsx
 * // Get all headers
 * const headers = useRequestHeaders();
 * console.log(headers['user-agent']);
 *
 * // Get specific headers (more efficient)
 * const { authorization, cookie } = useRequestHeaders(['authorization', 'cookie']);
 *
 * // Common use case: forward auth header
 * const { authorization } = useRequestHeaders(['authorization']);
 * const { data } = useFetch('/api/user', {
 *   headers: { authorization },
 * });
 * ```
 */
function useRequestHeaders(): Record<string, string | undefined>;
function useRequestHeaders<K extends CommonHeaderName>(
  include: K[]
): Pick<Record<K, string | undefined>, K>;
function useRequestHeaders(
  include?: CommonHeaderName[]
): Record<string, string | undefined> {
  const context = useContext(RequestContext);

  // No context or on client - return empty object
  if (!context?.headers) {
    return {};
  }

  // Return all headers
  if (!include || include.length === 0) {
    return context.headers;
  }

  // Return only requested headers
  const result: Record<string, string | undefined> = {};
  for (const key of include) {
    result[key] = context.headers[key.toLowerCase()];
  }
  return result;
}

export default useRequestHeaders;
