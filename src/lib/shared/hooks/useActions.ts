/**
 * useActions - Get typed actions from a store
 *
 * Provides easy access to store actions without importing the store directly.
 */

import { useMemo } from "react";
import { getStores } from "../store/createStore";

/**
 * useActions - Get actions from a named store
 *
 * @example
 * ```tsx
 * // Get all actions from a store
 * const { increment, decrement, reset } = useActions('counter');
 *
 * // Use in event handlers
 * <button onClick={increment}>+</button>
 *
 * // With arguments
 * const { setCount } = useActions('counter');
 * setCount(10);
 * ```
 */
function useActions<
  T extends Record<string, (...args: any[]) => any> = Record<
    string,
    (...args: any[]) => any
  >
>(storeName: string): T {
  return useMemo(() => {
    const stores = getStores();
    const store = stores.get(storeName);

    if (!store) {
      console.warn(
        `[ArcanaJS] Store "${storeName}" not found. Make sure to create it with createStore or defineStore.`
      );
      return {} as T;
    }

    return store.actions as T;
  }, [storeName]);
}

/**
 * useAction - Get a single action from a store
 *
 * @example
 * ```tsx
 * const increment = useAction('counter', 'increment');
 * <button onClick={increment}>+</button>
 * ```
 */
export function useAction<
  T extends (...args: any[]) => any = (...args: any[]) => any
>(storeName: string, actionName: string): T {
  return useMemo(() => {
    const stores = getStores();
    const store = stores.get(storeName);

    if (!store) {
      console.warn(`[ArcanaJS] Store "${storeName}" not found.`);
      return (() => {}) as T;
    }

    const action = (store.actions as any)[actionName];
    if (!action) {
      console.warn(
        `[ArcanaJS] Action "${actionName}" not found in store "${storeName}".`
      );
      return (() => {}) as T;
    }

    return action as T;
  }, [storeName, actionName]);
}

export default useActions;
