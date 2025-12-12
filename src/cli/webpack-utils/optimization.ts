import path from "path";
import webpack from "webpack";

const cwd = process.cwd();

export interface CacheConfig {
  type: "filesystem" | "memory";
  name: string;
  cacheDirectory: string;
  buildDependencies: {
    config: string[];
  };
  compression?: false | "gzip" | "brotli";
}

/**
 * Creates optimized cache configuration for webpack
 */
export function createCacheConfig(
  target: "client" | "server",
  isProduction: boolean
): CacheConfig {
  return {
    type: "filesystem",
    name: `arcanajs-${target}-${isProduction ? "prod" : "dev"}`,
    cacheDirectory: path.resolve(cwd, "node_modules/.cache/arcanajs/webpack"),
    buildDependencies: {
      config: [
        path.resolve(cwd, "package.json"),
        path.resolve(cwd, "tsconfig.json"),
      ],
    },
    compression: isProduction ? "gzip" : false,
  };
}

/**
 * Creates optimized resolve configuration
 */
export function createResolveConfig(aliases: Record<string, string>) {
  return {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: aliases,
    // Performance optimizations
    symlinks: false,
    cacheWithContext: false,
  };
}

/**
 * Creates optimized optimization configuration for development
 */
export function createDevOptimization(
  target: "client" | "server" = "client"
): webpack.Configuration["optimization"] {
  const baseConfig: webpack.Configuration["optimization"] = {
    // Skip expensive optimizations in dev
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
    minimize: false,
  };

  // Server doesn't need runtime chunk separation
  if (target === "server") {
    return {
      ...baseConfig,
      runtimeChunk: false,
    };
  }

  // Client uses separate runtime for faster rebuilds
  return {
    ...baseConfig,
    runtimeChunk: "single",
  };
}

/**
 * Creates optimized optimization configuration for production
 */
export function createProdOptimization(
  target: "client" | "server"
): webpack.Configuration["optimization"] {
  if (target === "server") {
    return {
      nodeEnv: false,
      splitChunks: false,
      minimize: true,
    };
  }

  return {
    minimize: true,
    splitChunks: {
      chunks: "all",
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        default: false,
        vendors: false,
        // React vendor chunk
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: "react-vendor",
          chunks: "all",
          priority: 40,
        },
        // Framework chunk (arcanajs)
        framework: {
          test: /[\\/]node_modules[\\/]arcanajs[\\/]/,
          name: "framework",
          chunks: "all",
          priority: 30,
        },
        // Common vendor chunk
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 20,
          minChunks: 2,
        },
        // Shared code between entry points
        shared: {
          name: "shared",
          minChunks: 2,
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },
    // Separate runtime chunk for better caching
    runtimeChunk: {
      name: "runtime",
    },
  };
}

/**
 * Creates output configuration optimized for path info
 */
export function createOutputConfig(
  outputPath: string,
  isProduction: boolean,
  target: "client" | "server"
): webpack.Configuration["output"] {
  const baseConfig = {
    path: outputPath,
    // Disable path info in development for performance
    pathinfo: false,
  };

  if (target === "server") {
    return {
      ...baseConfig,
      filename: "server.js",
    };
  }

  return {
    ...baseConfig,
    filename: isProduction ? "[name].[contenthash:8].js" : "[name].bundle.js",
    chunkFilename: isProduction
      ? "[name].[contenthash:8].chunk.js"
      : "[name].chunk.js",
    publicPath: "/",
    assetModuleFilename: "assets/[hash:8][ext]",
    // Clean output directory
    clean: true,
  };
}

/**
 * Creates watch options optimized for performance
 */
export function createWatchOptions(): webpack.Configuration["watchOptions"] {
  return {
    ignored: ["**/node_modules", "**/.arcanajs/**", "**/dist/**", "**/.git/**"],
    // Use native file system events
    poll: false,
    // Aggregate changes
    aggregateTimeout: 200,
  };
}

/**
 * Get devtool configuration based on environment
 * eval-cheap-module-source-map is fastest for dev with good quality
 */
export function getDevtool(
  isProduction: boolean,
  target: "client" | "server"
): webpack.Configuration["devtool"] {
  if (isProduction) {
    return "source-map";
  }

  // CSP-compliant source maps for development
  // eval variants don't work with strict CSP
  return "cheap-module-source-map";
}
