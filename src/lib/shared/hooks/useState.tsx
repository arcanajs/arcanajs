import React, { ReactNode, useState as reactUseState, useContext } from "react";
import { createSingletonContext } from "../utils/createSingletonContext";

/**
 * Shared state store for SSR hydration
 */
interface SharedStateStore {
  [key: string]: any;
}

// Global state store for SSR data transfer
const sharedStateStore: SharedStateStore = {};

// Context to pass initial state from server to client
export const SharedStateContext = createSingletonContext<SharedStateStore>(
  "SharedStateContext",
  {}
);

/**
 * Provider component for shared state (used in SSR)
 */
export const SharedStateProvider: React.FC<{
  initialState?: SharedStateStore;
  children: ReactNode;
}> = ({ initialState = {}, children }) => {
  return (
    <SharedStateContext.Provider value={initialState}>
      {children}
    </SharedStateContext.Provider>
  );
};

/**
 * useState - SSR-hydrated shared state hook
 *
 * Creates reactive state that can be shared across components and
 * persists across SSR hydration. Unlike React's useState, this state
 * is keyed and can be accessed from anywhere in the component tree.
 *
 * On the server, state is collected and serialized to the client.
 * On the client, state is hydrated from the server's initial values.
 *
 * @example
 * ```tsx
 * // Create or access shared state
 * const counter = useState<number>('counter', () => 0);
 * counter.value++; // Increment
 *
 * // In another component
 * const counter = useState<number>('counter', () => 0);
 * console.log(counter.value); // Same value!
 *
 * // Complex objects
 * const user = useState<User>('user', () => fetchUser());
 * ```
 */
function useState<T>(
  key: string,
  init?: () => T
): { value: T; set: (value: T | ((prev: T) => T)) => void } {
  const ssrState = useContext(SharedStateContext);

  // Get initial value from SSR state or initialize
  const getInitialValue = (): T => {
    // Check SSR hydrated state first
    if (key in ssrState) {
      return ssrState[key] as T;
    }

    // Check global store (for client-side access across components)
    if (key in sharedStateStore) {
      return sharedStateStore[key] as T;
    }

    // Initialize with factory function
    const initialValue = init ? init() : (undefined as T);
    sharedStateStore[key] = initialValue;
    return initialValue;
  };

  const [value, setValue] = reactUseState<T>(getInitialValue);

  // Custom setter that also updates the shared store
  const set = (newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const nextValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue;

      // Update shared store
      sharedStateStore[key] = nextValue;

      return nextValue;
    });
  };

  return {
    value,
    set,
  };
}

/**
 * Get all shared state for SSR serialization
 */
export function getSharedState(): SharedStateStore {
  return { ...sharedStateStore };
}

/**
 * Set shared state from server-side
 */
export function setSharedState(key: string, value: any): void {
  sharedStateStore[key] = value;
}

/**
 * Clear all shared state (for testing or cleanup)
 */
export function clearSharedState(): void {
  Object.keys(sharedStateStore).forEach((key) => {
    delete sharedStateStore[key];
  });
}

export default useState;
