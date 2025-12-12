import { useCallback, useContext, useState } from "react";
import { createSingletonContext } from "../utils/createSingletonContext";

/**
 * Error structure for ArcanaJS
 */
export interface ArcanaError {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Unique error identifier */
  name?: string;
  /** Stack trace (dev only) */
  stack?: string;
  /** Original error */
  cause?: Error;
  /** Whether this is a fatal error */
  fatal?: boolean;
  /** Data associated with the error */
  data?: any;
}

/**
 * Error context for global error state
 */
interface ErrorContextType {
  error: ArcanaError | null;
  setError: (error: ArcanaError | null) => void;
  clearError: () => void;
}

// Global error state
let globalError: ArcanaError | null = null;
const errorListeners: Array<(error: ArcanaError | null) => void> = [];

export const ErrorContext = createSingletonContext<ErrorContextType | null>(
  "ErrorContext",
  null
);

/**
 * Create error from various inputs
 */
export function createError(options: {
  statusCode?: number;
  message: string;
  name?: string;
  fatal?: boolean;
  cause?: Error;
  data?: any;
}): ArcanaError {
  return {
    statusCode: options.statusCode || 500,
    message: options.message,
    name: options.name || "ArcanaError",
    fatal: options.fatal ?? false,
    cause: options.cause,
    data: options.data,
    stack:
      process.env.NODE_ENV === "development" ? options.cause?.stack : undefined,
  };
}

/**
 * Set global error (for server-side or non-React contexts)
 */
export function setGlobalError(error: ArcanaError | null): void {
  globalError = error;
  errorListeners.forEach((listener) => listener(error));
}

/**
 * Get global error
 */
export function getGlobalError(): ArcanaError | null {
  return globalError;
}

/**
 * Clear global error
 */
export function clearGlobalError(): void {
  globalError = null;
  errorListeners.forEach((listener) => listener(null));
}

/**
 * Show error page (throws error for error boundary)
 */
export function showError(options: {
  statusCode?: number;
  message: string;
  fatal?: boolean;
}): never {
  const error = createError(options);
  setGlobalError(error);

  // Throw to trigger error boundary
  throw new Error(error.message);
}

/**
 * useError - Error handling hook (Nuxt-style)
 *
 * Provides access to the global error state and methods
 * to create/clear errors. Works with ArcanaJS error pages.
 *
 * @example
 * ```tsx
 * // Check for errors
 * const { error, clearError } = useError();
 *
 * if (error) {
 *   return (
 *     <div>
 *       <h1>Error {error.statusCode}</h1>
 *       <p>{error.message}</p>
 *       <button onClick={clearError}>Try Again</button>
 *     </div>
 *   );
 * }
 *
 * // Create an error
 * const { setError } = useError();
 *
 * const handleNotFound = () => {
 *   setError({
 *     statusCode: 404,
 *     message: 'Resource not found',
 *   });
 * };
 *
 * // Throw a fatal error
 * import { showError } from 'arcanajs/client';
 *
 * if (!user) {
 *   showError({
 *     statusCode: 401,
 *     message: 'Authentication required',
 *     fatal: true,
 *   });
 * }
 * ```
 */
function useError(): {
  error: ArcanaError | null;
  setError: (
    error: Partial<ArcanaError> & { message: string; statusCode?: number }
  ) => void;
  clearError: () => void;
} {
  const context = useContext(ErrorContext);

  // Use context if available (within ErrorProvider)
  if (context) {
    return {
      error: context.error,
      setError: (err) => context.setError(createError(err)),
      clearError: context.clearError,
    };
  }

  // Fallback to global state
  const [error, setLocalError] = useState<ArcanaError | null>(globalError);

  // Subscribe to global error changes
  useState(() => {
    const listener = (err: ArcanaError | null) => setLocalError(err);
    errorListeners.push(listener);
    return () => {
      const index = errorListeners.indexOf(listener);
      if (index > -1) errorListeners.splice(index, 1);
    };
  });

  const setError = useCallback(
    (err: Partial<ArcanaError> & { message: string; statusCode?: number }) => {
      const arcanaError = createError(err);
      setGlobalError(arcanaError);
      setLocalError(arcanaError);
    },
    []
  );

  const clearError = useCallback(() => {
    clearGlobalError();
    setLocalError(null);
  }, []);

  return {
    error,
    setError,
    clearError,
  };
}

export default useError;
