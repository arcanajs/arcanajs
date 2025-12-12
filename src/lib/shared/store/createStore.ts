/**
 * ArcanaJS Store - Professional State Management
 *
 * Features: Actions, Getters, Persistence, SSR Support, DevTools
 */

import { useMemo, useSyncExternalStore } from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * Store options type
 */
export interface StoreOptions<
  TState,
  TActions extends Record<string, ActionFn<TState>>,
  TGetters extends Record<string, GetterFn<TState>>
> {
  /** Unique store name */
  name: string;
  /** Initial state */
  state: TState;
  /** Actions that modify state */
  actions?: TActions;
  /** Computed getters */
  getters?: TGetters;
  /** Persistence options */
  persist?: boolean | PersistOptions;
}

/**
 * Action function type
 */
export type ActionFn<TState> = (
  state: TState,
  ...args: any[]
) => TState | Partial<TState>;

/**
 * Async action function type
 */
export type AsyncActionFn<TState> = (
  context: { state: TState; setState: (state: Partial<TState>) => void },
  ...args: any[]
) => Promise<void>;

/**
 * Getter function type
 */
export type GetterFn<TState> = (state: TState) => any;

/**
 * Persistence options
 */
export interface PersistOptions {
  /** Storage type */
  storage?: "localStorage" | "sessionStorage";
  /** Custom storage key */
  key?: string;
  /** Paths to persist (default: all) */
  paths?: string[];
  /** Serialize function */
  serialize?: (state: any) => string;
  /** Deserialize function */
  deserialize?: (str: string) => any;
}

/**
 * Store instance type
 */
export interface Store<
  TState,
  TActions extends Record<string, ActionFn<TState>>,
  TGetters extends Record<string, GetterFn<TState>>
> {
  /** Get current state */
  getState: () => TState;
  /** Set state (partial update) */
  setState: (
    partial: Partial<TState> | ((state: TState) => Partial<TState>)
  ) => void;
  /** Subscribe to state changes */
  subscribe: (listener: () => void) => () => void;
  /** Reset to initial state */
  reset: () => void;
  /** Actions object */
  actions: BoundActions<TState, TActions>;
  /** Getters object */
  getters: ComputedGetters<TState, TGetters>;
  /** Store name */
  name: string;
}

/**
 * Bound actions with proper typing
 */
export type BoundActions<
  TState,
  TActions extends Record<string, ActionFn<TState>>
> = {
  [K in keyof TActions]: TActions[K] extends (
    state: TState,
    ...args: infer P
  ) => any
    ? (...args: P) => void
    : never;
};

/**
 * Computed getters with proper typing
 */
export type ComputedGetters<
  TState,
  TGetters extends Record<string, GetterFn<TState>>
> = {
  [K in keyof TGetters]: ReturnType<TGetters[K]>;
};

/**
 * Hook return type
 */
export type UseStoreReturn<
  TState,
  TActions extends Record<string, ActionFn<TState>>,
  TGetters extends Record<string, GetterFn<TState>>
> = TState &
  ComputedGetters<TState, TGetters> & {
    /** Bound actions */
    actions: BoundActions<TState, TActions>;
    /** Direct setState */
    setState: (partial: Partial<TState>) => void;
    /** Reset to initial */
    reset: () => void;
  };

// ============================================================================
// Global Store Registry
// ============================================================================

const storeRegistry = new Map<string, Store<any, any, any>>();
const ssrStateRegistry = new Map<string, any>();

/**
 * Get all stores (for SSR serialization)
 */
export function getStores(): Map<string, Store<any, any, any>> {
  return storeRegistry;
}

/**
 * Get store state for SSR
 */
export function getStoreState(name: string): any {
  return storeRegistry.get(name)?.getState();
}

/**
 * Set SSR state for hydration
 */
export function setSSRStoreState(name: string, state: any): void {
  ssrStateRegistry.set(name, state);
}

/**
 * Get all store states for SSR serialization
 */
export function getAllStoreStates(): Record<string, any> {
  const states: Record<string, any> = {};
  storeRegistry.forEach((store, name) => {
    states[name] = store.getState();
  });
  return states;
}

/**
 * Hydrate stores from SSR
 */
export function hydrateStores(states: Record<string, any>): void {
  for (const [name, state] of Object.entries(states)) {
    ssrStateRegistry.set(name, state);
  }
}

// ============================================================================
// Persistence Helpers
// ============================================================================

function getStorage(type: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") return null;
  return type === "localStorage" ? window.localStorage : window.sessionStorage;
}

function loadFromStorage<T>(options: PersistOptions, name: string): T | null {
  const storage = getStorage(options.storage || "localStorage");
  if (!storage) return null;

  const key = options.key || `arcanajs-store-${name}`;
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const deserialize = options.deserialize || JSON.parse;
    return deserialize(raw);
  } catch {
    return null;
  }
}

function saveToStorage<T>(
  state: T,
  options: PersistOptions,
  name: string
): void {
  const storage = getStorage(options.storage || "localStorage");
  if (!storage) return;

  const key = options.key || `arcanajs-store-${name}`;
  const serialize = options.serialize || JSON.stringify;

  // Only persist specified paths if provided
  let toSave = state;
  if (options.paths && options.paths.length > 0) {
    toSave = {} as T;
    for (const path of options.paths) {
      (toSave as any)[path] = (state as any)[path];
    }
  }

  try {
    storage.setItem(key, serialize(toSave));
  } catch (e) {
    console.warn(`Failed to persist store "${name}":`, e);
  }
}

// ============================================================================
// DevTools
// ============================================================================

interface DevToolsMessage {
  type: string;
  storeName: string;
  action?: string;
  state?: any;
  prevState?: any;
}

const devToolsListeners: ((msg: DevToolsMessage) => void)[] = [];

function notifyDevTools(msg: DevToolsMessage): void {
  if (process.env.NODE_ENV !== "development") return;

  // Log to console in dev
  if (msg.type === "action") {
    console.log(
      `%c[ArcanaJS Store] ${msg.storeName}.${msg.action}`,
      "color: #9b59b6; font-weight: bold;",
      "\n  Prev:",
      msg.prevState,
      "\n  Next:",
      msg.state
    );
  }

  // Notify listeners (for custom devtools)
  devToolsListeners.forEach((fn) => fn(msg));
}

/**
 * Subscribe to devtools events
 */
export function subscribeToDevTools(
  fn: (msg: DevToolsMessage) => void
): () => void {
  devToolsListeners.push(fn);
  return () => {
    const idx = devToolsListeners.indexOf(fn);
    if (idx > -1) devToolsListeners.splice(idx, 1);
  };
}

// ============================================================================
// createStore - Core Store Factory
// ============================================================================

/**
 * Create a store with ArcanaJS API
 *
 * @example
 * ```typescript
 * const useCounterStore = createStore({
 *   name: 'counter',
 *   state: { count: 0 },
 *   actions: {
 *     increment: (state) => ({ count: state.count + 1 }),
 *     add: (state, amount: number) => ({ count: state.count + amount }),
 *   },
 *   getters: {
 *     doubleCount: (state) => state.count * 2,
 *   },
 *   persist: true,
 * });
 *
 * // In component
 * const { count, doubleCount, actions } = useCounterStore();
 * actions.increment();
 * ```
 */
export function createStore<
  TState extends object,
  TActions extends Record<string, ActionFn<TState>> = {},
  TGetters extends Record<string, GetterFn<TState>> = {}
>(
  options: StoreOptions<TState, TActions, TGetters>
): (() => UseStoreReturn<TState, TActions, TGetters>) & {
  /** Direct access to actions */
  actions: BoundActions<TState, TActions>;
  /** Get store instance */
  getStore: () => Store<TState, TActions, TGetters>;
  /** Get current state */
  getState: () => TState;
  /** Set state directly */
  setState: (partial: Partial<TState>) => void;
  /** Reset store */
  reset: () => void;
} {
  const {
    name,
    state: initialState,
    actions = {} as TActions,
    getters = {} as TGetters,
    persist,
  } = options;

  // Persistence config
  const persistOptions: PersistOptions | null = persist
    ? typeof persist === "boolean"
      ? {}
      : persist
    : null;

  // Load initial state from SSR or persistence
  let currentState: TState = { ...initialState };

  // Check SSR state first
  if (ssrStateRegistry.has(name)) {
    currentState = { ...currentState, ...ssrStateRegistry.get(name) };
  } else if (persistOptions) {
    const saved = loadFromStorage<Partial<TState>>(persistOptions, name);
    if (saved) {
      currentState = { ...currentState, ...saved };
    }
  }

  // Subscribers
  const listeners = new Set<() => void>();

  // Get state
  const getState = (): TState => currentState;

  // Set state
  const setState = (
    partial: Partial<TState> | ((state: TState) => Partial<TState>)
  ): void => {
    const prevState = currentState;
    const updates =
      typeof partial === "function" ? partial(currentState) : partial;
    currentState = { ...currentState, ...updates };

    // Persist
    if (persistOptions) {
      saveToStorage(currentState, persistOptions, name);
    }

    // Notify
    listeners.forEach((fn) => fn());

    // DevTools
    notifyDevTools({
      type: "setState",
      storeName: name,
      prevState,
      state: currentState,
    });
  };

  // Subscribe
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Reset
  const reset = (): void => {
    const prevState = currentState;
    currentState = { ...initialState };

    if (persistOptions) {
      const storage = getStorage(persistOptions.storage || "localStorage");
      storage?.removeItem(persistOptions.key || `arcanajs-store-${name}`);
    }

    listeners.forEach((fn) => fn());

    notifyDevTools({
      type: "reset",
      storeName: name,
      prevState,
      state: currentState,
    });
  };

  // Bind actions
  const boundActions = {} as BoundActions<TState, TActions>;
  for (const [key, actionFn] of Object.entries(actions)) {
    (boundActions as any)[key] = (...args: any[]) => {
      const prevState = currentState;
      const result = (actionFn as ActionFn<TState>)(currentState, ...args);

      // Handle partial or full state return
      if (result !== undefined) {
        currentState = { ...currentState, ...result };
      }

      // Persist
      if (persistOptions) {
        saveToStorage(currentState, persistOptions, name);
      }

      // Notify
      listeners.forEach((fn) => fn());

      // DevTools
      notifyDevTools({
        type: "action",
        storeName: name,
        action: key,
        prevState,
        state: currentState,
      });
    };
  }

  // Create computed getters proxy
  const computedGetters = new Proxy({} as ComputedGetters<TState, TGetters>, {
    get(_, prop: string) {
      if (prop in getters) {
        return (getters as any)[prop](currentState);
      }
      return undefined;
    },
  });

  // Store instance
  const store: Store<TState, TActions, TGetters> = {
    getState,
    setState,
    subscribe,
    reset,
    actions: boundActions,
    getters: computedGetters,
    name,
  };

  // Register store
  storeRegistry.set(name, store);

  // Hook function
  function useStore(): UseStoreReturn<TState, TActions, TGetters> {
    // Subscribe to store
    const state = useSyncExternalStore(
      subscribe,
      getState,
      getState // For SSR
    );

    // Memoize getters
    const getterValues = useMemo(() => {
      const values: Record<string, any> = {};
      for (const key of Object.keys(getters)) {
        values[key] = (getters as any)[key](state);
      }
      return values;
    }, [state]);

    // Return combined object
    return {
      ...state,
      ...getterValues,
      actions: boundActions,
      setState,
      reset,
    } as UseStoreReturn<TState, TActions, TGetters>;
  }

  // Attach static methods
  useStore.actions = boundActions;
  useStore.getStore = () => store;
  useStore.getState = getState;
  useStore.setState = setState;
  useStore.reset = reset;

  return useStore as any;
}

// ============================================================================
// defineStore - Pinia-style Store Definition
// ============================================================================

/**
 * Options for defineStore
 */
export interface DefineStoreOptions<TState> {
  /** State factory function */
  state: () => TState;
  /** Actions (can be async) */
  actions?: Record<
    string,
    (
      this: TState & { setState: (partial: Partial<TState>) => void },
      ...args: any[]
    ) => any
  >;
  /** Computed getters */
  getters?: Record<string, (state: TState) => any>;
  /** Persistence */
  persist?: boolean | PersistOptions;
}

/**
 * Define a store with Pinia-like API
 *
 * @example
 * ```typescript
 * const useUserStore = defineStore('user', {
 *   state: () => ({
 *     user: null,
 *     loading: false,
 *   }),
 *   actions: {
 *     async login(email: string, password: string) {
 *       this.loading = true;
 *       this.user = await api.login(email, password);
 *       this.loading = false;
 *     },
 *   },
 *   getters: {
 *     isLoggedIn: (state) => state.user !== null,
 *   },
 *   persist: true,
 * });
 * ```
 */
export function defineStore<TState extends object>(
  name: string,
  options: DefineStoreOptions<TState>
): () => TState & {
  actions: Record<string, (...args: any[]) => any>;
  getters: Record<string, any>;
  setState: (partial: Partial<TState>) => void;
  reset: () => void;
} {
  const { state: stateFactory, actions = {}, getters = {}, persist } = options;

  const initialState = stateFactory();

  // Convert Pinia-style actions to createStore format
  const convertedActions: Record<string, ActionFn<TState>> = {};

  // Store reference for this binding
  let storeRef: Store<TState, any, any> | null = null;

  // Create the store
  const useHook = createStore({
    name,
    state: initialState,
    actions: convertedActions,
    getters,
    persist,
  });

  storeRef = useHook.getStore();

  // Create bound actions with proper this binding
  const boundActions: Record<string, (...args: any[]) => any> = {};

  for (const [key, actionFn] of Object.entries(actions)) {
    boundActions[key] = async (...args: any[]) => {
      const state = storeRef!.getState();

      // Create proxy for this binding
      const thisProxy = new Proxy(state, {
        set(target, prop, value) {
          storeRef!.setState({ [prop]: value } as Partial<TState>);
          return true;
        },
        get(target, prop) {
          if (prop === "setState") {
            return (partial: Partial<TState>) => storeRef!.setState(partial);
          }
          return (target as any)[prop];
        },
      });

      notifyDevTools({
        type: "action",
        storeName: name,
        action: key,
        prevState: state,
        state: storeRef!.getState(),
      });

      return actionFn.apply(thisProxy as any, args);
    };
  }

  // Return hook with additional properties
  return function useDefinedStore() {
    const hookResult = useHook();

    return {
      ...hookResult,
      actions: boundActions,
      getters: hookResult,
    };
  };
}

export default createStore;
