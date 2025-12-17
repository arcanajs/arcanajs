import React from "react";
import { createSingletonContext } from "../utils/createSingletonContext";

/**
 * Request context data structure
 * Contains SSR-specific information from the incoming request
 */
export interface RequestContextType {
  /** Request headers */
  headers: Record<string, string | undefined>;
  /** Request cookies */
  cookies: Record<string, string | undefined>;
  /** Request URL */
  url: string;
  /** Request path */
  path: string;
  /** Query parameters */
  query: Record<string, string | string[] | undefined>;
  /** Request method */
  method: string;
  /** Client IP address */
  ip?: string;
  /** User agent */
  userAgent?: string;
  /** Whether this is an SSR request */
  isSSR: boolean;
}

/**
 * Default request context (client-side)
 */
const defaultRequestContext: RequestContextType = {
  headers: {},
  cookies: {},
  url: typeof window !== "undefined" ? window.location.href : "",
  path: typeof window !== "undefined" ? window.location.pathname : "",
  query: {},
  method: "GET",
  isSSR: false,
};

/**
 * Request context for SSR
 */
export const RequestContext = createSingletonContext<RequestContextType | null>(
  "RequestContext",
  null
);

/**
 * Request context provider for SSR
 */
export const RequestContextProvider: React.FC<{
  value: RequestContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <RequestContext.Provider value={value}>{children}</RequestContext.Provider>
  );
};

/**
 * Create request context from Express request
 */
export function createRequestContext(
  req: any // Express Request
): RequestContextType {
  const headers: Record<string, string | undefined> = {};

  // Copy headers (lowercase keys)
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key.toLowerCase()] = Array.isArray(value)
        ? value.join(", ")
        : (value as string);
    }
  }

  // Parse cookies
  const cookies: Record<string, string | undefined> = {};
  if (req.cookies) {
    Object.assign(cookies, req.cookies);
  } else if (headers.cookie) {
    // Parse cookie header manually
    headers.cookie.split(";").forEach((cookie) => {
      const [key, ...valueParts] = cookie.trim().split("=");
      if (key) {
        cookies[key] = valueParts.join("=");
      }
    });
  }

  // Parse query
  const query: Record<string, string | string[] | undefined> = {};
  if (req.query) {
    Object.assign(query, req.query);
  }

  return {
    headers,
    cookies,
    url: req.url || req.originalUrl || "",
    path: req.path || "",
    query,
    method: req.method || "GET",
    ip: req.ip || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: headers["user-agent"],
    isSSR: true,
  };
}

/**
 * Get request context on client (returns default values)
 */
export function getClientRequestContext(): RequestContextType {
  if (typeof window === "undefined") {
    return defaultRequestContext;
  }

  // Parse cookies from document.cookie
  const cookies: Record<string, string | undefined> = {};
  document.cookie.split(";").forEach((cookie) => {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key) {
      try {
        cookies[key] = decodeURIComponent(valueParts.join("="));
      } catch {
        cookies[key] = valueParts.join("=");
      }
    }
  });

  // Parse query from URL
  const query: Record<string, string | string[] | undefined> = {};
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  });

  return {
    headers: {
      "user-agent": navigator.userAgent,
    },
    cookies,
    url: window.location.href,
    path: window.location.pathname,
    query,
    method: "GET",
    userAgent: navigator.userAgent,
    isSSR: false,
  };
}
