import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path from "path";
import webpack from "webpack";
import nodeExternals from "webpack-node-externals";

const isProduction = process.env.NODE_ENV === "production";
const cwd = process.cwd();

// Helper to resolve loaders from the framework's node_modules
const resolveLoader = (loader: string) => require.resolve(loader);

import fs from "fs";

// Helper to find entry file with supported extensions
const findEntry = (searchPaths: string[]): string => {
  const extensions = [".ts", ".tsx", ".js", ".jsx"];

  for (const basePath of searchPaths) {
    for (const ext of extensions) {
      const fullPath = path.resolve(cwd, basePath + ext);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
      // Also check for index files in directories
      const indexPath = path.resolve(cwd, basePath, "index" + ext);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }

  // Fallback to example if not found (for internal framework dev) or throw error
  // For now, we'll try the example paths as a last resort before failing
  const exampleClient = path.resolve(cwd, "src/example/client/index.tsx");
  const exampleServer = path.resolve(cwd, "src/example/server/index.ts");

  if (
    searchPaths.some((p) => p.includes("client")) &&
    fs.existsSync(exampleClient)
  )
    return exampleClient;
  if (
    searchPaths.some((p) => p.includes("server")) &&
    fs.existsSync(exampleServer)
  )
    return exampleServer;

  throw new Error(
    `Could not find entry point. Searched in: ${searchPaths.join(", ")}`
  );
};

export const createClientConfig = (): webpack.Configuration => {
  const clientEntry = findEntry([
    "src/client",
    "src/client/index",
    "src/index",
    "src/main",
  ]);

  return {
    mode: isProduction ? "production" : "development",
    target: "web",
    entry: {
      client: clientEntry,
    },
    output: {
      path: path.resolve(cwd, "dist/public"),
      filename: isProduction
        ? "[name].[contenthash].bundle.js"
        : "[name].bundle.js",
      publicPath: "/",
      assetModuleFilename: "assets/[hash][ext][query]",
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../../node_modules")],
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: resolveLoader("babel-loader"),
            options: {
              presets: [
                resolveLoader("@babel/preset-env"),
                resolveLoader("@babel/preset-react"),
                resolveLoader("@babel/preset-typescript"),
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProduction
              ? MiniCssExtractPlugin.loader
              : resolveLoader("style-loader"),
            resolveLoader("css-loader"),
            resolveLoader("postcss-loader"),
          ],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|eot|ttf|otf)$/i,
          type: "asset/resource",
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "../lib/server/default-index.html"),
        filename: "index.html",
        inject: "body",
        minify: isProduction
          ? {
              removeComments: false,
              collapseWhitespace: true,
              removeRedundantAttributes: true,
              useShortDoctype: true,
              removeEmptyAttributes: true,
              removeStyleLinkTypeAttributes: true,
              keepClosingSlash: true,
              minifyJS: true,
              minifyCSS: true,
              minifyURLs: true,
            }
          : false,
      }),
      new MiniCssExtractPlugin({
        filename: isProduction ? "[name].[contenthash].css" : "[name].css",
      }),
    ],
    optimization: {
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
        },
      },
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
  };
};

export const createServerConfig = (): webpack.Configuration => {
  const serverEntry = findEntry([
    "src/server",
    "src/server/index",
    "src/server/main",
  ]);

  return {
    mode: isProduction ? "production" : "development",
    target: "node",
    entry: serverEntry,
    output: {
      path: path.resolve(cwd, "dist"),
      filename: "server.js",
    },
    externals: [nodeExternals()],
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../../node_modules")],
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: resolveLoader("babel-loader"),
            options: {
              presets: [
                resolveLoader("@babel/preset-env"),
                resolveLoader("@babel/preset-react"),
                resolveLoader("@babel/preset-typescript"),
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: resolveLoader("null-loader"), // Ignore CSS on server side
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|eot|ttf|otf)$/i,
          type: "asset/resource",
          generator: {
            emit: false,
          },
        },
      ],
    },
    // devtool: isProduction ? "source-map" : "eval-source-map",
  };
};
