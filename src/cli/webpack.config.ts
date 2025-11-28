import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path from "path";
import webpack from "webpack";
import nodeExternals from "webpack-node-externals";

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

const getViewsLoaderPath = () => {
  const viewsDir = path.resolve(cwd, "src/views");
  const hasViews = fs.existsSync(viewsDir);
  const viewsLoaderPath = path.resolve(
    __dirname,
    "../../node_modules/.cache/arcanajs/views-loader.js"
  );

  // Ensure cache directory exists
  const cacheDir = path.dirname(viewsLoaderPath);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Generate the loader file
  const loaderContent = hasViews
    ? `module.exports = require.context('${viewsDir}', true, /\\.(tsx|jsx)$/);`
    : `module.exports = null;`;

  fs.writeFileSync(viewsLoaderPath, loaderContent);
  return viewsLoaderPath;
};

export const createClientConfig = (): webpack.Configuration => {
  const isProduction = process.env.NODE_ENV === "production";
  const viewsLoaderPath = getViewsLoaderPath();
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
      alias: {
        "arcana-views": viewsLoaderPath,
      },
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
                [
                  resolveLoader("@babel/preset-react"),
                  { runtime: "automatic" },
                ],
                resolveLoader("@babel/preset-typescript"),
              ],
            },
          },
        },
        // CSS Modules rule for .module.css files
        {
          test: /\.module\.css$/,
          use: [
            isProduction
              ? MiniCssExtractPlugin.loader
              : resolveLoader("style-loader"),
            {
              loader: resolveLoader("css-loader"),
              options: {
                importLoaders: 1,
                modules: {
                  localIdentName: isProduction
                    ? "[hash:base64:8]"
                    : "[path][name]__[local]--[hash:base64:5]",
                  exportLocalsConvention: "camelCaseOnly",
                },
              },
            },
            {
              loader: resolveLoader("postcss-loader"),
              options: {
                postcssOptions: {
                  config: path.resolve(cwd, "postcss.config.js"),
                },
              },
            },
          ],
        },
        // Global CSS rule for regular .css files
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: [
            isProduction
              ? MiniCssExtractPlugin.loader
              : resolveLoader("style-loader"),
            {
              loader: resolveLoader("css-loader"),
              options: {
                importLoaders: 1,
              },
            },
            {
              loader: resolveLoader("postcss-loader"),
              options: {
                postcssOptions: {
                  config: path.resolve(cwd, "postcss.config.js"),
                },
              },
            },
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
        templateContent: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--HEAD_CONTENT-->
  </head>
  <body>
    <div id="root"><!--APP_CONTENT--></div>
    <!--ARCANAJS_DATA_SCRIPT-->
  </body>
</html>`,
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
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: "react-vendor",
            chunks: "all",
            priority: 10,
          },
        },
      },
    },
    performance: {
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
      hints: isProduction ? "warning" : false,
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
  };
};

export const createServerConfig = (): webpack.Configuration => {
  const isProduction = process.env.NODE_ENV === "production";
  const serverEntry = findEntry([
    "src/server",
    "src/server/index",
    "src/server/main",
  ]);

  const viewsLoaderPath = getViewsLoaderPath();

  return {
    mode: isProduction ? "production" : "development",
    target: "node",
    entry: serverEntry,
    output: {
      path: path.resolve(cwd, "dist"),
      filename: "server.js",
    },
    externals: [
      nodeExternals({
        allowlist: [/^arcanajs/],
      }),
    ],
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      alias: {
        "arcana-views": viewsLoaderPath,
      },
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
                [
                  resolveLoader("@babel/preset-react"),
                  { runtime: "automatic" },
                ],
                resolveLoader("@babel/preset-typescript"),
              ],
            },
          },
        },
        // CSS Modules rule for .module.css files on server (for SSR)
        {
          test: /\.module\.css$/,
          use: {
            loader: resolveLoader("css-loader"),
            options: {
              modules: {
                localIdentName: isProduction
                  ? "[hash:base64:8]"
                  : "[path][name]__[local]--[hash:base64:5]",
                exportLocalsConvention: "camelCaseOnly",
                exportOnlyLocals: true, // Only export class names, not CSS
              },
            },
          },
        },
        // Regular CSS files - ignore on server side
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: resolveLoader("null-loader"),
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
    devtool: isProduction ? "source-map" : "eval-source-map",
  };
};
