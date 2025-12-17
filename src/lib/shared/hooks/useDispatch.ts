/**
 * useDispatch - dispatch hook for ArcanaJS
 *
 * Returns a dispatch function that can be used to trigger actions
 * across all stores or a specific store.
 */

import { useCallback, useMemo } from "react";
import { getStores } from "../store/createStore";

/**
 * Action object type 
 */
export interface Action<T = any> {
  type: string;
  payload?: T;
}

/**
 * Dispatch function type
 */
export type Dispatch = <T = any>(
  action: Action<T> | string,
  payload?: T
) => void;

/**
 * useDispatch - Get a dispatch function for triggering actions
 * works with ArcanaJS stores.
 * Can dispatch to a specific store or broadcast to all stores.
 *
 * @example
 * ```tsx
 * const dispatch = useDispatch();
 *
 * // Dispatch with action object
 * dispatch({ type: 'counter/increment' });
 * dispatch({ type: 'counter/add', payload: 5 });
 *
 * // Dispatch with type and payload
 * dispatch('counter/increment');
 * dispatch('counter/add', 5);
 * ```
 *
 * @example
 * ```tsx
 * // With store-specific dispatch
 * const dispatch = useDispatch('counter');
 * dispatch('increment'); // Only affects counter store
 * ```
 */
function useDispatch(storeName?: string): Dispatch {
  const dispatch = useCallback(
    <T = any>(action: Action<T> | string, payload?: T): void => {
      const stores = getStores();

      // Parse action
      const actionType = typeof action === "string" ? action : action.type;
      const actionPayload =
        typeof action === "string" ? payload : action.payload;

      // Parse store and action name from type (format: "storeName/actionName")
      let targetStore: string | undefined;
      let actionName: string;

      if (actionType.includes("/")) {
        const [store, name] = actionType.split("/");
        targetStore = store;
        actionName = name;
      } else {
        targetStore = storeName;
        actionName = actionType;
      }

      // If specific store is targeted
      if (targetStore) {
        const store = stores.get(targetStore);
        if (!store) {
          console.warn(`[ArcanaJS] Store "${targetStore}" not found.`);
          return;
        }

        const storeAction = (store.actions as any)[actionName];
        if (!storeAction) {
          console.warn(
            `[ArcanaJS] Action "${actionName}" not found in store "${targetStore}".`
          );
          return;
        }

        // Call the action with payload
        if (actionPayload !== undefined) {
          storeAction(actionPayload);
        } else {
          storeAction();
        }
        return;
      }

      // Broadcast to all stores that have this action
      stores.forEach((store, name) => {
        const storeAction = (store.actions as any)[actionName];
        if (storeAction) {
          if (actionPayload !== undefined) {
            storeAction(actionPayload);
          } else {
            storeAction();
          }
        }
      });
    },
    [storeName]
  );

  return dispatch;
}

/**
 * Create a typed dispatch for a specific store
 *
 * @example
 * ```tsx
 * const counterDispatch = useTypedDispatch<CounterActions>('counter');
 * counterDispatch.increment();
 * counterDispatch.add(5);
 * ```
 */
export function useTypedDispatch<
  T extends Record<string, (...args: any[]) => void>
>(storeName: string): T {
  return useMemo(() => {
    const stores = getStores();
    const store = stores.get(storeName);

    if (!store) {
      console.warn(`[ArcanaJS] Store "${storeName}" not found.`);
      return {} as T;
    }

    return store.actions as T;
  }, [storeName]);
}

export default useDispatch;
