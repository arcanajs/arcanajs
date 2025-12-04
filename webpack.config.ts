import path from "node:path";
import webpack from "webpack";
import nodeExternals from "webpack-node-externals";

const cwd = process.cwd();

const config: webpack.Configuration = {
  mode: "production",
  target: "node",
  entry: {
    arcanajs: path.resolve(cwd, "src/lib/index.server.ts"),
    arcanox: path.resolve(cwd, "src/lib/index.arcanox.ts"),
    "arcanajs.client": path.resolve(cwd, "src/lib/index.client.ts"),
    "arcanajs.validator": path.resolve(cwd, "src/lib/index.validator.ts"),
    "arcanajs.auth": path.resolve(cwd, "src/lib/index.auth.ts"),
    "arcanajs.mail": path.resolve(cwd, "src/lib/index.mail.ts"),
    "cli/index": path.resolve(cwd, "src/cli/index.ts"),
  },
  output: {
    path: path.resolve(cwd, "dist"),
    filename: "[name].js",
    library: {
      type: "commonjs",
    },
    clean: false,
  },
  optimization: {
    nodeEnv: false,
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
  plugins: [
    // We don't want to clean everything because tsc runs first and outputs d.ts files
    // But we can clean .js files if we want. For now, let's rely on tsc cleaning or manual clean.
    // actually, let's not use CleanWebpackPlugin here if we are mixing with tsc output in the same dir
  ],
  devtool: "source-map",
};

export default config;
