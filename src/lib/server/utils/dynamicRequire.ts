declare const __non_webpack_require__: NodeJS.Require;

/**
 * Helper to dynamically require modules at runtime, bypassing Webpack bundling.
 * This is necessary for loading user configuration files, migrations, and views
 * that are not part of the framework bundle but exist in the user's project.
 */
export const dynamicRequire = (id: string) => {
  // Use a string lookup to access the native require function via process.mainModule
  // This prevents Webpack from seeing "require" and warning about critical dependencies.
  // It also ensures we get the native Node require, not Webpack's internal require.
  try {
    const _global = global as any;
    const nativeRequire = _global["process"]?.["mainModule"]?.["require"];
    if (nativeRequire) {
      return nativeRequire(id);
    }
  } catch (e) {
    // Ignore errors during lookup
  }

  // Fallback to eval("require") if mainModule lookup fails.
  // This might return Webpack's require in some contexts, but it's a last resort.
  return eval("require")(id);
};
