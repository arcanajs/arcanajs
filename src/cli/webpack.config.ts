import path from "path";
import webpack from "webpack";
import nodeExternals from "webpack-node-externals";

import {
  createAssetRule,
  // Optimization
  createCacheConfig,
  createCssModuleRule,
  createDevOptimization,
  createGlobalCssRule,
  createMapIgnoreRule,
  createOutputConfig,
  createProdOptimization,
  createResolveConfig,
  createServerCssRules,
  // Loaders
  createTsRule,
  createWatchOptions,
  // Entries
  generateViewsLoader,
  getClientEntries,
  // Plugins
  getClientPlugins,
  getCommonAliases,
  getDevtool,
  getServerEntry,
  getServerPlugins,
} from "./webpack-utils";

const cwd = process.cwd();

/**
 * Creates optimized client webpack configuration
 */
export function createClientConfig(): webpack.Configuration {
  const isProduction = process.env.NODE_ENV === "production";
  const viewsLoaderPath = generateViewsLoader();
  const entries = getClientEntries(isProduction);
  const aliases = getCommonAliases(viewsLoaderPath);

  return {
    name: "client",
    mode: isProduction ? "production" : "development",
    target: "web",
    entry: entries,

    output: createOutputConfig(
      path.resolve(cwd, ".arcanajs/client"),
      isProduction,
      "client"
    ),

    // Filesystem cache for faster rebuilds
    cache: createCacheConfig("client", isProduction),

    resolve: createResolveConfig(aliases),

    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
    },

    module: {
      rules: [
        createTsRule(isProduction),
        createMapIgnoreRule(),
        createCssModuleRule(isProduction),
        createGlobalCssRule(isProduction),
        createAssetRule(true),
      ],
    },

    plugins: getClientPlugins(isProduction),

    optimization: isProduction
      ? createProdOptimization("client")
      : createDevOptimization("client"),

    performance: {
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
      hints: isProduction ? "warning" : false,
    },

    devtool: getDevtool(isProduction, "client"),

    watchOptions: createWatchOptions([
      // Client doesn't need to rebuild when server code changes
      path.resolve(cwd, "src/app"),
      path.resolve(cwd, "src/config"),
      path.resolve(cwd, "src/bootstrap/server.ts"),
    ]),

    // Improved stats output
    stats: {
      preset: "errors-warnings",
      assets: isProduction,
      colors: true,
      timings: true,
    },

    // Infrastructure logging
    infrastructureLogging: {
      level: "warn",
    },
  };
}

/**
 * Creates optimized server webpack configuration
 */
export function createServerConfig(): webpack.Configuration {
  const isProduction = process.env.NODE_ENV === "production";
  const viewsLoaderPath = generateViewsLoader();
  const serverEntry = getServerEntry();
  const aliases = getCommonAliases(viewsLoaderPath);

  return {
    name: "server",
    mode: isProduction ? "production" : "development",
    target: "node",
    entry: serverEntry,

    output: createOutputConfig(
      path.resolve(cwd, ".arcanajs/server"),
      isProduction,
      "server"
    ),

    // Filesystem cache for faster rebuilds
    cache: createCacheConfig("server", isProduction),

    externals: [
      nodeExternals({
        allowlist: [/^arcanajs/],
      }),
    ],

    resolve: createResolveConfig(aliases),

    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
    },

    module: {
      rules: [
        createTsRule(isProduction),
        createMapIgnoreRule(),
        ...createServerCssRules(isProduction),
        createAssetRule(false), // Don't emit assets on server
      ],
    },

    plugins: getServerPlugins(isProduction),

    optimization: isProduction
      ? createProdOptimization("server")
      : createDevOptimization("server"),

    devtool: getDevtool(isProduction, "server"),

    watchOptions: createWatchOptions([
      // Server doesn't need to rebuild when public assets change
      path.resolve(cwd, "src/public"),
      path.resolve(cwd, "src/bootstrap/client.ts"),
      // Ignore views in dev to prevent server restarts (enables HMR)
      // SSR will be stale until manual restart, but dev speed is prioritized
      path.resolve(cwd, "src/resources/views"),
    ]),

    stats: {
      preset: "errors-warnings",
      colors: true,
      timings: true,
    },

    infrastructureLogging: {
      level: "warn",
    },

    // Ignore express dynamic require warning
    ignoreWarnings: [
      {
        module: /node_modules\/express\/lib\/view\.js/,
        message: /Critical dependency/,
      },
    ],
  };
}

/**
 * Creates multi-compiler configuration for parallel builds
 * This builds both client and server simultaneously
 */
export function createMultiConfig(): webpack.Configuration[] {
  return [createClientConfig(), createServerConfig()];
}

// Re-export for backward compatibility
export {
  createClientConfig as getClientConfig,
  createServerConfig as getServerConfig,
};
