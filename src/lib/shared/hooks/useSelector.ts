/**
 * useSelector - Select state from stores with memoization
 *
 * Subscribes to store updates and re-renders only when selected value changes.
 * Prevents unnecessary re-renders with shallow equality by default.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";
import { getStores } from "../store/createStore";

/**
 * Equality function type
 */
export type EqualityFn<T> = (a: T, b: T) => boolean;

/**
 * Default shallow equality check
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as any)[key], (b as any)[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get combined state from all stores
 */
function getCombinedState(): Record<string, any> {
  const state: Record<string, any> = {};
  getStores().forEach((store, name) => {
    state[name] = store.getState();
  });
  return state;
}

/**
 * Subscribe to all stores
 */
function subscribeToAllStores(callback: () => void): () => void {
  const unsubscribes: (() => void)[] = [];

  getStores().forEach((store) => {
    unsubscribes.push(store.subscribe(callback));
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

/**
 * useSelector - Select state from stores with memoization
 *
 * Subscribes to store updates and re-renders only when selected value changes.
 *
 * @example
 * ```tsx
 * // Select from a specific store
 * const count = useSelector(state => state.counter?.count ?? 0);
 *
 * // Select with custom equality
 * const items = useSelector(
 *   state => state.cart?.items ?? [],
 *   (a, b) => a.length === b.length
 * );
 *
 * // Select multiple values
 * const { user, isLoading } = useSelector(state => ({
 *   user: state.user?.data,
 *   isLoading: state.user?.loading ?? false,
 * }));
 * ```
 */
function useSelector<T>(
  selector: (state: Record<string, any>) => T,
  equalityFn: EqualityFn<T> = shallowEqual
): T {
  const prevValueRef = useRef<T | undefined>(undefined);

  // Get snapshot with memoization
  const getSnapshot = useCallback((): T => {
    const state = getCombinedState();
    const nextValue = selector(state);

    // Use equality function to determine if we should return cached value
    if (
      prevValueRef.current !== undefined &&
      equalityFn(prevValueRef.current, nextValue)
    ) {
      return prevValueRef.current;
    }

    prevValueRef.current = nextValue;
    return nextValue;
  }, [selector, equalityFn]);

  return useSyncExternalStore(
    subscribeToAllStores,
    getSnapshot,
    getSnapshot // Server snapshot
  );
}

/**
 * Create a selector with memoization
 *
 * @example
 * ```tsx
 * const selectTotalPrice = createSelector(
 *   state => state.cart?.items ?? [],
 *   (items) => items.reduce((sum, item) => sum + item.price, 0)
 * );
 *
 * const total = useSelector(selectTotalPrice);
 * ```
 */
export function createSelector<TState, TResult, TIntermediate>(
  inputSelector: (state: TState) => TIntermediate,
  resultFn: (intermediate: TIntermediate) => TResult
): (state: TState) => TResult {
  let lastInput: TIntermediate | undefined;
  let lastResult: TResult | undefined;

  return (state: TState): TResult => {
    const input = inputSelector(state);

    if (lastInput !== undefined && Object.is(input, lastInput)) {
      return lastResult!;
    }

    lastInput = input;
    lastResult = resultFn(input);
    return lastResult;
  };
}

/**
 * useShallowEqualSelector - Selector with shallow equality comparison
 *
 * Like useSelector but uses shallow equality for the result comparison.
 * Useful when selecting objects or arrays.
 *
 * @example
 * ```tsx
 * // Won't re-render if object contents are the same
 * const user = useShallowEqualSelector(state => ({
 *   name: state.user?.name,
 *   email: state.user?.email,
 * }));
 * ```
 */
export function useShallowEqualSelector<T>(
  selector: (state: Record<string, any>) => T
): T {
  return useSelector(selector, shallowEqual);
}

/**
 * useSelectorWithDeps - Selector with dependencies
 *
 * Re-creates the selector when dependencies change.
 * Useful when the selector depends on props or other values.
 *
 * @example
 * ```tsx
 * const item = useSelectorWithDeps(
 *   (state) => state.items?.find(i => i.id === itemId),
 *   [itemId]
 * );
 * ```
 */
export function useSelectorWithDeps<T>(
  selectorCreator: () => (state: Record<string, any>) => T,
  deps: any[]
): T {
  const selector = useCallback(selectorCreator(), deps);
  return useSelector(selector);
}

/**
 * useMultiSelector - Select from multiple stores at once
 *
 * @example
 * ```tsx
 * const { count, userName } = useMultiSelector({
 *   count: state => state.counter?.count ?? 0,
 *   userName: state => state.user?.name ?? 'Guest',
 * });
 * ```
 */
export function useMultiSelector<T extends Record<string, any>>(selectors: {
  [K in keyof T]: (state: Record<string, any>) => T[K];
}): T {
  return useSelector((state) => {
    const result = {} as T;
    for (const [key, selector] of Object.entries(selectors)) {
      result[key as keyof T] = selector(state);
    }
    return result;
  }, shallowEqual);
}

export default useSelector;
