import { useCallback, useEffect, useRef } from "react";
import useRouter from "./useRouter";

/**
 * Navigation event handlers
 */
export interface NavigationEventHandlers {
  /** Called when navigation starts */
  onStart?: (url: string) => void;
  /** Called when navigation completes successfully */
  onComplete?: (url: string) => void;
  /** Called when navigation fails */
  onError?: (error: Error) => void;
  /** Called when URL changes (for any reason) */
  onChange?: (url: string, previousUrl?: string) => void;
}

/**
 * useNavigationEvents - Subscribe to navigation lifecycle events
 *
 * Listen to navigation events for analytics, loading indicators,
 * progress bars, or any other side effects during navigation.
 *
 * @example
 * ```tsx
 * // Analytics tracking
 * useNavigationEvents({
 *   onComplete: (url) => {
 *     analytics.pageView(url);
 *   }
 * });
 *
 * // Loading bar
 * useNavigationEvents({
 *   onStart: () => NProgress.start(),
 *   onComplete: () => NProgress.done(),
 *   onError: () => NProgress.done(),
 * });
 *
 * // Log all navigation
 * useNavigationEvents({
 *   onChange: (url, prevUrl) => {
 *     console.log(`Navigated from ${prevUrl} to ${url}`);
 *   }
 * });
 *
 * // Save scroll position
 * useNavigationEvents({
 *   onStart: () => {
 *     sessionStorage.setItem('scrollY', window.scrollY.toString());
 *   }
 * });
 * ```
 */
function useNavigationEvents(handlers: NavigationEventHandlers): void {
  const { currentUrl, isNavigating, previousUrl } = useRouter();

  // Store handlers in ref to avoid re-running effect on handler changes
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Track previous navigating state
  const wasNavigating = useRef(false);

  // Track previous URL for change detection
  const prevUrlRef = useRef(currentUrl);

  // Handle navigation state changes
  useEffect(() => {
    const { onStart, onComplete, onError } = handlersRef.current;

    // Navigation started
    if (isNavigating && !wasNavigating.current) {
      wasNavigating.current = true;
      onStart?.(currentUrl);
    }

    // Navigation completed
    if (!isNavigating && wasNavigating.current) {
      wasNavigating.current = false;
      onComplete?.(currentUrl);
    }
  }, [isNavigating, currentUrl]);

  // Handle URL changes
  useEffect(() => {
    const { onChange } = handlersRef.current;

    if (currentUrl !== prevUrlRef.current) {
      onChange?.(currentUrl, prevUrlRef.current);
      prevUrlRef.current = currentUrl;
    }
  }, [currentUrl]);
}

/**
 * Create a navigation event handler that only fires once
 */
export function useNavigationEventOnce(
  event: "start" | "complete" | "error" | "change",
  handler: (url: string, prevUrl?: string) => void
): void {
  const firedRef = useRef(false);

  const wrappedHandler = useCallback(
    (url: string, prevUrl?: string) => {
      if (!firedRef.current) {
        firedRef.current = true;
        handler(url, prevUrl);
      }
    },
    [handler]
  );

  const handlers: NavigationEventHandlers = {
    [event === "start"
      ? "onStart"
      : event === "complete"
      ? "onComplete"
      : event === "error"
      ? "onError"
      : "onChange"]: wrappedHandler,
  };

  useNavigationEvents(handlers);
}

export default useNavigationEvents;
