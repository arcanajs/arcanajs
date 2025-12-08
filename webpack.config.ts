import { createRequire } from "node:module";
import path from "node:path";
import webpack from "webpack";
import nodeExternals from "webpack-node-externals";

const require = createRequire(import.meta.url);
const TerserPlugin = require("terser-webpack-plugin");

const cwd = process.cwd();

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
    path: path.resolve(cwd, "dist"),
    library: {
      type: "commonjs",
    },
    clean: false,
  },
  externals: [
    nodeExternals({ allowlist: ["reflect-metadata"] }),
    "arcana-views",
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { targets: { node: "16" } }],
              "@babel/preset-react",
              "@babel/preset-typescript",
            ],
          },
        },
      },
    ],
  },
  plugins: [],
  devtool: "source-map",
};

const devConfig: webpack.Configuration = {
  ...commonConfig,
  mode: "development",
  entry: {
    ...(commonConfig.entry as Record<string, string>),
    // Add HMR client only in development
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
  mode: "production",
  output: {
    ...commonConfig.output,
    path: path.resolve(cwd, "dist/production"),
    filename: "[name].min.js",
  },
  optimization: {
    nodeEnv: false,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
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
