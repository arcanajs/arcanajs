import fs from "fs";
import path from "path";

const cwd = process.cwd();

/**
 * Find entry file with supported extensions
 */
export function findEntry(searchPaths: string[]): string {
  const extensions = [".ts", ".tsx", ".js", ".jsx"];

  for (const basePath of searchPaths) {
    for (const ext of extensions) {
      const fullPath = path.resolve(cwd, basePath + ext);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
      // Check for index files in directories
      const indexPath = path.resolve(cwd, basePath, "index" + ext);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }

  throw new Error(
    `Could not find entry point. Searched in: ${searchPaths.join(", ")}`
  );
}

/**
 * Generate views loader for webpack context
 */
export function generateViewsLoader(): string {
  const viewsDir = path.resolve(cwd, "src/resources/views");
  const hasViews = fs.existsSync(viewsDir);
  const cacheDir = path.resolve(cwd, "node_modules/.cache/arcanajs");
  const viewsLoaderPath = path.resolve(cacheDir, "views-loader.js");

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Generate the loader file
  const loaderContent = hasViews
    ? `module.exports = require.context('${viewsDir.replace(
        /\\/g,
        "/"
      )}', true, /\\.(tsx|jsx)$/);`
    : `module.exports = null;`;

  fs.writeFileSync(viewsLoaderPath, loaderContent);
  return viewsLoaderPath;
}

/**
 * Get HMR client path if available
 */
export function getHmrClientPath(): string | null {
  // Resolve from compiled CLI location (dist/cli -> dist/lib/client)
  const hmrClientPath = path.resolve(__dirname, "../lib/client/hmr-client.js");

  if (fs.existsSync(hmrClientPath)) {
    return hmrClientPath;
  }

  // Try alternative paths
  const altPaths = [
    path.resolve(cwd, "node_modules/arcanajs/dist/lib/client/hmr-client.js"),
    path.resolve(__dirname, "../../dist/lib/client/hmr-client.js"),
  ];

  for (const p of altPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  console.warn("[ArcanaJS] HMR client not found - hot reload will not work");
  return null;
}

/**
 * Get client entry points
 */
export function getClientEntries(
  isProduction: boolean
): Record<string, string> {
  const clientEntry = findEntry(["src/bootstrap/client"]);
  const entries: Record<string, string> = {
    client: clientEntry,
  };

  if (!isProduction) {
    const hmrPath = getHmrClientPath();
    if (hmrPath) {
      entries["hmr-client"] = hmrPath;
    }
  }

  return entries;
}

/**
 * Get server entry point
 */
export function getServerEntry(): string {
  return findEntry(["src/bootstrap/server"]);
}

/**
 * Get common aliases for webpack resolve
 */
export function getCommonAliases(
  viewsLoaderPath: string
): Record<string, string> {
  return {
    "arcana-views": viewsLoaderPath,
    "@": path.resolve(cwd, "src"),
  };
}
