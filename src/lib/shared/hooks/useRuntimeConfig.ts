import { useContext } from "react";
import { createSingletonContext } from "../utils/createSingletonContext";

/**
 * Runtime configuration structure
 */
export interface RuntimeConfig {
  /** Public config - accessible on both server and client */
  public: Record<string, any>;
  /** Private config - only accessible on server */
  private?: Record<string, any>;
  /** App metadata */
  app?: {
    name?: string;
    version?: string;
    env?: string;
    baseUrl?: string;
  };
}

// Default runtime config
const defaultConfig: RuntimeConfig = {
  public: {},
  private: {},
  app: {
    name: "ArcanaJS App",
    version: "1.0.0",
    env: process.env.NODE_ENV || "development",
    baseUrl: "",
  },
};

// Global runtime config
let runtimeConfig: RuntimeConfig = { ...defaultConfig };

// Context for passing config from server
export const RuntimeConfigContext = createSingletonContext<RuntimeConfig>(
  "RuntimeConfigContext",
  defaultConfig
);

/**
 * Set runtime configuration (call on server startup)
 */
export function setRuntimeConfig(config: Partial<RuntimeConfig>): void {
  runtimeConfig = {
    public: { ...defaultConfig.public, ...config.public },
    private: { ...defaultConfig.private, ...config.private },
    app: { ...defaultConfig.app, ...config.app },
  };
}

/**
 * Get runtime configuration (server-side)
 */
export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfig;
}

/**
 * Get public runtime config (safe for client)
 */
export function getPublicRuntimeConfig(): RuntimeConfig {
  return {
    public: runtimeConfig.public,
    app: runtimeConfig.app,
  };
}

/**
 * useRuntimeConfig - Access runtime configuration (Nuxt-style)
 *
 * Returns the runtime configuration object.
 * On the client, only public config is available.
 * On the server, full config including private values is accessible.
 *
 * @example
 * ```tsx
 * // In your component
 * const config = useRuntimeConfig();
 *
 * // Access public config (available on both server and client)
 * const apiUrl = config.public.apiUrl;
 *
 * // Access private config (server only)
 * if (typeof window === 'undefined') {
 *   const apiKey = config.private?.apiKey;
 * }
 *
 * // Access app metadata
 * const appName = config.app?.name;
 * ```
 *
 * @example
 * ```typescript
 * // Server setup (in ArcanaJS config)
 * import { setRuntimeConfig } from 'arcanajs/client';
 *
 * setRuntimeConfig({
 *   public: {
 *     apiUrl: 'https://api.example.com',
 *   },
 *   private: {
 *     apiKey: process.env.API_KEY,
 *   },
 * });
 * ```
 */
function useRuntimeConfig(): RuntimeConfig {
  const contextConfig = useContext(RuntimeConfigContext);

  // On client, strip private config
  if (typeof window !== "undefined") {
    return {
      public: contextConfig.public || runtimeConfig.public,
      app: contextConfig.app || runtimeConfig.app,
    };
  }

  // On server, return full config
  return {
    public: contextConfig.public || runtimeConfig.public,
    private: contextConfig.private || runtimeConfig.private,
    app: contextConfig.app || runtimeConfig.app,
  };
}

export default useRuntimeConfig;
