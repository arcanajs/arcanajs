const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  mode: isProduction ? "production" : "development",
  target: "web",
  entry: {
    client: "./src/example/client/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist/public"),
    filename: isProduction
      ? "[name].[contenthash].bundle.js"
      : "[name].bundle.js",
    publicPath: "/",
    assetModuleFilename: "assets/[hash][ext][query]",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.css$/,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : "style-loader",
          "css-loader",
          "postcss-loader",
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
      template: "./src/lib/server/default-index.html",
      filename: "index.html",
      inject: "body",
      minify: isProduction,
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
