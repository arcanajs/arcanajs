import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import nodeExternals from "webpack-node-externals";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const TerserPlugin = require("terser-webpack-plugin");

const cwd = process.cwd();

// SWC Configuration factory
const getSwcConfig = (isDev: boolean) => ({
  jsc: {
    parser: {
      syntax: "typescript",
      tsx: true,
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
      react: {
        runtime: "automatic",
        development: isDev,
      },
    },
    target: "es2020",
  },
  module: {
    type: "commonjs",
  },
});

// Base cache configuration
const baseCache: webpack.FileCacheOptions = {
  type: "filesystem",
  buildDependencies: {
    config: [__filename],
  },
};

const commonConfig: webpack.Configuration = {
  target: "node",
  entry: {
    arcanajs: path.resolve(cwd, "src/lib/index.server.ts"),
    arcanox: path.resolve(cwd, "src/lib/index.arcanox.ts"),
    "arcanajs.client": path.resolve(cwd, "src/lib/index.client.ts"),
    "arcanajs.di": path.resolve(cwd, "src/lib/index.di.ts"),
    "arcanajs.validator": path.resolve(cwd, "src/lib/index.validator.ts"),
    "arcanajs.auth": path.resolve(cwd, "src/lib/index.auth.ts"),
    "arcanajs.mail": path.resolve(cwd, "src/lib/index.mail.ts"),
    "cli/index": path.resolve(cwd, "src/cli/index.ts"),
  },
  output: {
    library: {
      type: "commonjs",
    },
    clean: false,
  },
  externals: [
    nodeExternals({ allowlist: ["reflect-metadata"] }),
    "arcanajs-views",
    "react",
    "react-dom",
    "react-dom/client",
    "react-dom/server",
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      react: path.resolve(cwd, "node_modules/react"),
      "react-dom": path.resolve(cwd, "node_modules/react-dom"),
    },
  },
  plugins: [],
  // Use non-eval sourcemaps to support strict CSP in consumer apps
  devtool: "cheap-module-source-map",
};

const devConfig: webpack.Configuration = {
  ...commonConfig,
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "swc-loader",
          options: getSwcConfig(true),
        },
      },
    ],
  },
  mode: "development",
  name: "development",
  // Unique cache name for development build
  cache: {
    ...baseCache,
    name: "arcanajs-framework-build-development",
  },
  entry: {
    ...(commonConfig.entry as Record<string, string>),
    "lib/client/hmr-client": path.resolve(cwd, "src/lib/client/hmr-client.ts"),
  },
  output: {
    ...commonConfig.output,
    path: path.resolve(cwd, "dist/development"),
    filename: "[name].js",
  },
  optimization: {
    nodeEnv: false,
    minimize: false,
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          name: "common",
        },
      },
    },
  },
};

const prodConfig: webpack.Configuration = {
  ...commonConfig,
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "swc-loader",
          options: getSwcConfig(false),
        },
      },
    ],
  },
  mode: "production",
  name: "production",
  // Unique cache name for production build
  cache: {
    ...baseCache,
    name: "arcanajs-framework-build-production",
  },
  output: {
    ...commonConfig.output,
    path: path.resolve(cwd, "dist/production"),
    filename: "[name].min.js",
  },
  devtool: "source-map",
  optimization: {
    nodeEnv: false,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            passes: 2,
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
        parallel: true,
      }),
    ],
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          name: "common",
        },
      },
    },
  },
};

export default [devConfig, prodConfig];
