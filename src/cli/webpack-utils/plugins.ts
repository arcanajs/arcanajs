import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";

const cwd = process.cwd();

/**
 * Creates HTML plugin for client build
 */
export function createHtmlPlugin(isProduction: boolean): HtmlWebpackPlugin {
  return new HtmlWebpackPlugin({
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
  });
}

/**
 * Creates CSS extraction plugin
 */
export function createCssPlugin(isProduction: boolean): MiniCssExtractPlugin {
  return new MiniCssExtractPlugin({
    filename: isProduction ? "[name].[contenthash:8].css" : "[name].css",
    chunkFilename: isProduction
      ? "[name].[contenthash:8].chunk.css"
      : "[name].chunk.css",
  });
}

/**
 * Creates clean plugin (only for production)
 */
export function createCleanPlugin(): CleanWebpackPlugin {
  return new CleanWebpackPlugin();
}

/**
 * Creates define plugin for environment variables
 */
export function createDefinePlugin(
  isProduction: boolean,
  target: "client" | "server"
): webpack.DefinePlugin {
  return new webpack.DefinePlugin({
    "process.env.NODE_ENV": JSON.stringify(
      isProduction ? "production" : "development"
    ),
    "process.env.BUILD_TARGET": JSON.stringify(target),
    __DEV__: JSON.stringify(!isProduction),
    __SERVER__: JSON.stringify(target === "server"),
    __CLIENT__: JSON.stringify(target === "client"),
  });
}

/**
 * Creates progress plugin (dev only, minimal output)
 */
export function createProgressPlugin(): webpack.ProgressPlugin {
  let lastPercent = 0;

  return new webpack.ProgressPlugin({
    activeModules: false,
    entries: true,
    handler: (percentage, message) => {
      const percent = Math.round(percentage * 100);
      // Only log significant progress to avoid spam
      if (percent - lastPercent >= 10 || percent === 100) {
        lastPercent = percent;
        if (percent < 100) {
          process.stdout.write(`\r⏳ Building... ${percent}%`);
        } else {
          process.stdout.write(`\r✓ Build complete!     \n`);
        }
      }
    },
    modules: false,
    modulesCount: 5000,
    profile: false,
  });
}

/**
 * Creates ignore plugin for optional dependencies
 */
export function createIgnorePlugin(): webpack.IgnorePlugin {
  return new webpack.IgnorePlugin({
    resourceRegExp: /^\.\/locale$/,
    contextRegExp: /moment$/,
  });
}

/**
 * Get all client plugins
 */
export function getClientPlugins(
  isProduction: boolean
): webpack.WebpackPluginInstance[] {
  const plugins: webpack.WebpackPluginInstance[] = [
    createDefinePlugin(isProduction, "client"),
    createHtmlPlugin(isProduction),
    createCssPlugin(isProduction),
    createIgnorePlugin(),
  ];

  if (isProduction) {
    plugins.unshift(createCleanPlugin());
  } else {
    // Progress plugin only in dev
    plugins.push(createProgressPlugin());
  }

  return plugins;
}

/**
 * Get all server plugins
 */
export function getServerPlugins(
  isProduction: boolean
): webpack.WebpackPluginInstance[] {
  const plugins: webpack.WebpackPluginInstance[] = [
    createDefinePlugin(isProduction, "server"),
    createIgnorePlugin(),
  ];

  if (!isProduction) {
    plugins.push(createProgressPlugin());
  }

  return plugins;
}
