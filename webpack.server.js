const path = require("path");
const nodeExternals = require("webpack-node-externals");

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  mode: isProduction ? "production" : "development",
  target: "node",
  entry: "./src/example/server/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js",
  },
  externals: [nodeExternals()],
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
        use: "null-loader", // Ignore CSS on server side
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
        generator: {
          emit: false, // Don't emit files for server build, just get paths
        },
      },
    ],
  },
  devtool: isProduction ? "source-map" : "eval-source-map",
};
