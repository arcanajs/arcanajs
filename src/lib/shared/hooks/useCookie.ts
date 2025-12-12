import { useState as reactUseState, useCallback, useEffect } from "react";

/**
 * Options for useCookie hook
 */
export interface UseCookieOptions {
  /** Default value if cookie doesn't exist */
  default?: string;
  /** Max age in seconds */
  maxAge?: number;
  /** Expiration date */
  expires?: Date;
  /** Cookie path (default: '/') */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag (HTTPS only) */
  secure?: boolean;
  /** HTTP only (not accessible via JS) - only works on server */
  httpOnly?: boolean;
  /** SameSite attribute */
  sameSite?: "strict" | "lax" | "none";
  /** Watch for external changes (default: false) */
  watch?: boolean;
  /** Readonly - don't allow modifications */
  readonly?: boolean;
}

/**
 * Return type for useCookie hook
 */
export interface UseCookieReturn<T> {
  /** Current cookie value */
  value: T | null;
  /** Set cookie value */
  set: (value: T) => void;
  /** Remove cookie */
  remove: () => void;
  /** Refresh value from document.cookie */
  refresh: () => void;
}

/**
 * Parse cookie string to get specific cookie value
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) {
      const value = valueParts.join("=");
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

/**
 * Set a cookie with options
 */
function setCookie(
  name: string,
  value: string,
  options: UseCookieOptions = {}
): void {
  if (typeof document === "undefined") return;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) {
    cookieString += `; max-age=${options.maxAge}`;
  }

  if (options.expires) {
    cookieString += `; expires=${options.expires.toUTCString()}`;
  }

  cookieString += `; path=${options.path || "/"}`;

  if (options.domain) {
    cookieString += `; domain=${options.domain}`;
  }

  if (options.secure) {
    cookieString += "; secure";
  }

  if (options.sameSite) {
    cookieString += `; samesite=${options.sameSite}`;
  }

  document.cookie = cookieString;
}

/**
 * Remove a cookie
 */
function removeCookie(name: string, options: UseCookieOptions = {}): void {
  if (typeof document === "undefined") return;

  const expires = new Date(0);
  setCookie(name, "", { ...options, expires });
}

/**
 * useCookie - SSR-safe cookie management hook (Nuxt-style)
 *
 * Provides reactive cookie access with read/write capabilities.
 * SSR-safe: returns null on server, hydrates on client.
 *
 * @example
 * ```tsx
 * // Simple usage
 * const { value, set, remove } = useCookie<string>('theme');
 *
 * // With default value
 * const { value } = useCookie('locale', { default: 'en' });
 *
 * // With options
 * const { value, set } = useCookie('token', {
 *   maxAge: 60 * 60 * 24 * 7, // 1 week
 *   secure: true,
 *   sameSite: 'strict',
 * });
 *
 * // JSON values
 * const { value, set } = useCookie<{ id: string }>('user');
 * set({ id: '123' }); // Automatically serialized
 * ```
 */
function useCookie<T = string>(
  name: string,
  options: UseCookieOptions = {}
): UseCookieReturn<T> {
  const {
    default: defaultValue,
    readonly = false,
    watch = false,
    ...cookieOptions
  } = options;

  // Parse value from cookie
  const parseValue = useCallback((): T | null => {
    const rawValue = getCookie(name);
    if (rawValue === null) {
      return (defaultValue as T) ?? null;
    }

    // Try to parse as JSON
    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return rawValue as unknown as T;
    }
  }, [name, defaultValue]);

  const [value, setValue] = reactUseState<T | null>(() => {
    if (typeof window === "undefined") {
      return (defaultValue as T) ?? null;
    }
    return parseValue();
  });

  // Hydrate on client
  useEffect(() => {
    setValue(parseValue());
  }, [parseValue]);

  // Watch for external changes
  useEffect(() => {
    if (!watch || typeof window === "undefined") return;

    // Poll for changes (no native cookie change event)
    const intervalId = setInterval(() => {
      const currentValue = parseValue();
      setValue((prev) => {
        const prevStr = JSON.stringify(prev);
        const currStr = JSON.stringify(currentValue);
        return prevStr !== currStr ? currentValue : prev;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [watch, parseValue]);

  // Set cookie value
  const set = useCallback(
    (newValue: T) => {
      if (readonly) return;

      const serialized =
        typeof newValue === "string" ? newValue : JSON.stringify(newValue);

      setCookie(name, serialized, cookieOptions);
      setValue(newValue);
    },
    [name, readonly, cookieOptions]
  );

  // Remove cookie
  const remove = useCallback(() => {
    if (readonly) return;

    removeCookie(name, cookieOptions);
    setValue((defaultValue as T) ?? null);
  }, [name, readonly, defaultValue, cookieOptions]);

  // Refresh from document.cookie
  const refresh = useCallback(() => {
    setValue(parseValue());
  }, [parseValue]);

  return {
    value,
    set,
    remove,
    refresh,
  };
}

export default useCookie;
