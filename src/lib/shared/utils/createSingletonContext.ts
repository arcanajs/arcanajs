import React, { createContext } from "react";

/**
 * Creates a React Context that persists across multiple module loads (Webpack bundles vs Node require).
 * This is essential for SSR applications where the server bundle and dynamically loaded views
 * might reference different instances of the "same" context module.
 *
 * @param key A unique string key to identify this context globally
 * @param defaultValue The default value for the context
 * @returns A React Context instance (singleton)
 */
export function createSingletonContext<T>(
  key: string,
  defaultValue: T
): React.Context<T> {
  const globalAny = globalThis as any;
  const symbolKey = Symbol.for(`ARCANAJS_CONTEXT_${key}`);

  if (!globalAny[symbolKey]) {
    globalAny[symbolKey] = createContext<T>(defaultValue);
  }

  return globalAny[symbolKey];
}
