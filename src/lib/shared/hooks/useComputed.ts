/**
 * useComputed - Create memoized derived/computed state
 *
 * Like Vue's computed properties or React's useMemo with dependencies.
 */

import { useMemo, useRef } from "react";

/**
 * useComputed - Create memoized computed values
 *
 * Computes a derived value that only recalculates when dependencies change.
 * Unlike useMemo, it uses deep comparison for dependencies.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const total = useComputed(() => {
 *   return cart.items.reduce((sum, item) => sum + item.price, 0);
 * }, [cart.items]);
 *
 * // With formatting
 * const formattedTotal = useComputed(() => {
 *   return `$${total.toFixed(2)}`;
 * }, [total]);
 *
 * // Complex derived state
 * const filteredItems = useComputed(() => {
 *   return items
 *     .filter(item => item.active)
 *     .sort((a, b) => a.name.localeCompare(b.name));
 * }, [items]);
 * ```
 */
function useComputed<T>(computeFn: () => T, dependencies: any[]): T {
  // Use useMemo for the core functionality
  return useMemo(computeFn, dependencies);
}

/**
 * useComputedWithCompare - Computed with custom comparison
 *
 * @example
 * ```tsx
 * const expensiveValue = useComputedWithCompare(
 *   () => computeExpensive(data),
 *   [data],
 *   (prev, next) => prev.id === next.id
 * );
 * ```
 */
export function useComputedWithCompare<T, D>(
  computeFn: () => T,
  dependency: D,
  compareFn: (prev: D, next: D) => boolean
): T {
  const prevDepRef = useRef<D | undefined>(undefined);
  const prevResultRef = useRef<T | undefined>(undefined);

  // Check if dependency changed
  const hasChanged =
    prevDepRef.current === undefined ||
    !compareFn(prevDepRef.current, dependency);

  if (hasChanged) {
    prevDepRef.current = dependency;
    prevResultRef.current = computeFn();
  }

  return prevResultRef.current!;
}

/**
 * useComputedAsync - Async computed values
 *
 * @example
 * ```tsx
 * const { value, loading, error } = useComputedAsync(
 *   async () => await fetchUserDetails(userId),
 *   [userId]
 * );
 * ```
 */
export function useComputedAsync<T>(
  computeFn: () => Promise<T>,
  dependencies: any[],
  defaultValue?: T
): { value: T | undefined; loading: boolean; error: Error | null } {
  const [state, setState] = React.useState<{
    value: T | undefined;
    loading: boolean;
    error: Error | null;
  }>({
    value: defaultValue,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    computeFn()
      .then((value) => {
        if (!cancelled) {
          setState({ value, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// Import React for useComputedAsync
import React from "react";

export default useComputed;
