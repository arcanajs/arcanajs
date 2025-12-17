/**
 * useStore - Access store instance directly
 *
 * Returns a reference to a store or all stores.
 */

import { useMemo } from "react";
import { getStores, Store } from "../store/createStore";

/**
 * useStore - Get direct access to a store instance
 *
 * This hook should be used sparingly. Prefer useSelector for reading state.
 * Useful for accessing store methods like reset(), or for imperative operations.
 *
 * @example
 * ```tsx
 * // Get a specific store
 * const counterStore = useStore('counter');
 * console.log(counterStore.getState());
 * counterStore.reset();
 *
 * // Get all stores
 * const allStores = useStore();
 * allStores.forEach((store, name) => console.log(name, store.getState()));
 * ```
 */
function useStore(): Map<string, Store<any, any, any>>;
function useStore<TState extends object>(
  storeName: string
): Store<TState, any, any> | null;
function useStore<TState extends object>(
  storeName?: string
): Store<TState, any, any> | Map<string, Store<any, any, any>> | null {
  return useMemo(() => {
    const stores = getStores();

    if (storeName === undefined) {
      return stores;
    }

    const store = stores.get(storeName);
    if (!store) {
      console.warn(`[ArcanaJS] Store "${storeName}" not found.`);
      return null;
    }

    return store as Store<TState, any, any>;
  }, [storeName]);
}

/**
 * useStoreState - Get current state from a store (non-reactive)
 *
 * Returns the current state snapshot. Does NOT subscribe to changes.
 * Use useSelector for reactive state that triggers re-renders.
 *
 * @example
 * ```tsx
 * const onClick = () => {
 *   const currentState = useStoreState('counter');
 *   console.log('Current count:', currentState?.count);
 * };
 * ```
 */
export function useStoreState<TState extends object>(
  storeName: string
): TState | null {
  return useMemo(() => {
    const stores = getStores();
    const store = stores.get(storeName);
    return store ? (store.getState() as TState) : null;
  }, [storeName]);
}

/**
 * useStoreReset - Get reset function for a store
 *
 * @example
 * ```tsx
 * const resetCounter = useStoreReset('counter');
 * <button onClick={resetCounter}>Reset</button>
 * ```
 */
export function useStoreReset(storeName: string): (() => void) | null {
  return useMemo(() => {
    const stores = getStores();
    const store = stores.get(storeName);
    return store ? store.reset : null;
  }, [storeName]);
}

export default useStore;
