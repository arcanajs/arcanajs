import path from "path";

declare const __non_webpack_require__: NodeJS.Require;

const cwd = process.cwd();

/**
 * Helper to resolve loaders from the framework's node_modules
 */
export const resolveLoader = (loader: string): string =>
  __non_webpack_require__.resolve(loader);

/**
 * Creates babel loader options optimized for performance
 */
export function createBabelLoaderOptions(isProduction: boolean) {
  return {
    presets: [
      [
        resolveLoader("@babel/preset-env"),
        {
          // Only transform what's needed
          useBuiltIns: false,
          modules: false,
        },
      ],
      [resolveLoader("@babel/preset-react"), { runtime: "automatic" }],
      resolveLoader("@babel/preset-typescript"),
    ],
    plugins: [
      resolveLoader("babel-plugin-transform-typescript-metadata"),
      [resolveLoader("@babel/plugin-proposal-decorators"), { legacy: true }],
      [
        resolveLoader("@babel/plugin-transform-class-properties"),
        { loose: true },
      ],
      [
        resolveLoader("@babel/plugin-transform-private-methods"),
        { loose: true },
      ],
      [
        resolveLoader("@babel/plugin-transform-private-property-in-object"),
        { loose: true },
      ],
    ],
    // Enable caching for babel-loader
    cacheDirectory: true,
    cacheCompression: false,
    // Compact output in production
    compact: isProduction,
  };
}

/**
 * Creates the TypeScript/JavaScript rule
 */
export function createTsRule(isProduction: boolean) {
  return {
    test: /\.(ts|tsx|js|jsx)$/,
    include: [path.resolve(cwd, "src")],
    exclude: [/node_modules/],
    use: {
      loader: resolveLoader("babel-loader"),
      options: createBabelLoaderOptions(isProduction),
    },
  };
}

/**
 * Creates CSS module rule for client with HMR support
 */
export function createCssModuleRule(isProduction: boolean) {
  const MiniCssExtractPlugin = require("mini-css-extract-plugin");

  // Use style-loader with HMR in development
  const styleLoader = isProduction
    ? MiniCssExtractPlugin.loader
    : {
        loader: resolveLoader("style-loader"),
        options: {
          // Insert styles at top for proper cascade
          insert: "head",
          // Enable HMR for style-loader
          esModule: true,
        },
      };

  return {
    test: /\.module\.css$/,
    use: [
      styleLoader,
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
  };
}

/**
 * Creates global CSS rule for client with HMR support
 */
export function createGlobalCssRule(isProduction: boolean) {
  const MiniCssExtractPlugin = require("mini-css-extract-plugin");

  // Use style-loader with HMR in development
  const styleLoader = isProduction
    ? MiniCssExtractPlugin.loader
    : {
        loader: resolveLoader("style-loader"),
        options: {
          insert: "head",
          esModule: true,
        },
      };

  return {
    test: /\.css$/,
    exclude: /\.module\.css$/,
    use: [
      styleLoader,
      {
        loader: resolveLoader("css-loader"),
        options: { importLoaders: 1 },
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
  };
}

/**
 * Creates CSS rules for server-side rendering
 */
export function createServerCssRules(isProduction: boolean) {
  return [
    // CSS Modules for SSR - only export class names
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
            exportOnlyLocals: true,
          },
        },
      },
    },
    // Ignore global CSS on server
    {
      test: /\.css$/,
      exclude: /\.module\.css$/,
      use: resolveLoader("null-loader"),
    },
  ];
}

/**
 * Creates asset rules
 */
export function createAssetRule(emitFiles: boolean = true) {
  return {
    test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|eot|ttf|otf|ico)$/i,
    type: "asset/resource" as const,
    generator: {
      emit: emitFiles,
    },
  };
}

/**
 * Creates rule to ignore source map files
 */
export function createMapIgnoreRule() {
  return {
    test: /\.map$/,
    use: resolveLoader("null-loader"),
  };
}
