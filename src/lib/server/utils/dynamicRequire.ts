/*
  dynamicRequire.ts
  Robust dynamic require/import helper for ArcanaJS
  - Works on Node 18+ (including Node 24)
  - Avoids private Node internals (Module._nodeModulePaths, process.mainModule)
  - Uses createRequire for a native require function that survives Webpack bundling
  - Supports .js/.cjs/.mjs/.ts files
  - Prefer synchronous require when possible (dynamicRequireSync)
  - Provide async dynamicRequire for ESM fallback (dynamic import)

  Integration notes and tests are included below as comments.
*/

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

declare const __non_webpack_require__: NodeJS.Require | undefined;

const baseNativeRequire: NodeJS.Require =
  typeof __non_webpack_require__ === "function"
    ? __non_webpack_require__
    : new Function("return require")();

function getNativeRequire(): NodeJS.Require {
  return baseNativeRequire;
}

let tsNodeRegistered = false;

/**
 * Try to register ts-node if available. This is synchronous and will make
 * `require()` work for TypeScript files in most setups.
 */
function tryRegisterTsNode() {
  if (tsNodeRegistered) return;
  try {
    // Use eval(require) to avoid bundlers rewriting require calls when this
    // file is itself bundled. createRequire ensures we call native require.
    const nativeRequire = getNativeRequire();
    const tsNode = nativeRequire("ts-node");
    if (tsNode && typeof tsNode.register === "function") {
      tsNode.register({
        skipProject: true,
        transpileOnly: true,
        compilerOptions: {
          module: "commonjs",
          target: "es2020",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: "node",
        },
      });
      tsNodeRegistered = true;
    }
  } catch (e) {
    // ts-node not available or registration failed: it's fine, we'll fallback to
    // manual transpilation when necessary.
  }
}

/**
 * Synchronously require a module using a native require function.
 * If the module is an ESM (ERR_REQUIRE_ESM), this function will throw and
 * callers should use the async dynamicRequire() to import ESM files.
 */
export function dynamicRequireSync(request: string): any {
  // create a native require anchored to this module to avoid webpack's fake require
  const nativeRequire = getNativeRequire();

  // For TypeScript files, attempt to register ts-node so require can load them.
  if (request.endsWith(".ts")) {
    tryRegisterTsNode();
  }

  // Resolve absolute path if possible to avoid ambiguous resolution in nested projects
  let resolvedPath: string;
  try {
    const paths = nativeRequire.resolve.paths(request) || [];
    resolvedPath = nativeRequire.resolve(request, { paths });
  } catch (resolveErr) {
    // If resolve fails, try resolving relative to cwd
    const candidate = path.resolve(process.cwd(), request);
    if (fs.existsSync(candidate)) {
      resolvedPath = candidate;
    } else {
      // last resort: let native require throw the original error
      return nativeRequire(request);
    }
  }

  try {
    return nativeRequire(resolvedPath);
  } catch (err: any) {
    // If the module is ESM, Node signals with ERR_REQUIRE_ESM. We must not
    // attempt to force require here — instead throw so caller can use async import.
    if (
      err &&
      (err.code === "ERR_REQUIRE_ESM" ||
        err.code === "ERR_UNKNOWN_FILE_EXTENSION")
    ) {
      throw err; // caller should use dynamicRequire (async) for ESM
    }

    // If require failed for TypeScript and ts-node isn't available, attempt manual transpile + execute
    if (resolvedPath.endsWith(".ts")) {
      try {
        const code = fs.readFileSync(resolvedPath, "utf8");
        // lazy-load typescript to avoid forcing dependency at runtime
        const nativeRequireForTS = getNativeRequire();
        const ts = nativeRequireForTS("typescript");
        const transpiled = ts.transpileModule(code, {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
          },
        }).outputText;

        // Create a Module instance and compile the transpiled code
        const ModuleCtor = module.constructor as any;
        const m = new ModuleCtor(resolvedPath, module);
        m.filename = resolvedPath;
        // Compose reasonable lookup paths without using private API
        const lookup =
          nativeRequireForTS.resolve.paths(request) || module.paths;
        m.paths = lookup;
        m._compile(transpiled, resolvedPath);
        return m.exports;
      } catch (compileErr) {
        // If manual compilation fails, rethrow the original require error for visibility
        throw err;
      }
    }

    // otherwise rethrow
    throw err;
  }
}

/**
 * Async-safe dynamic require/import helper.
 * - Always prefer synchronous native require when possible
 * - If the module is ESM, uses dynamic import() (await import())
 * - Works for .ts by attempting ts-node registration or transpiling on the fly
 */
export async function dynamicRequire(request: string): Promise<any> {
  const nativeRequire = getNativeRequire();

  // If TypeScript, try ts-node first (so require might work)
  if (request.endsWith(".ts")) {
    tryRegisterTsNode();
  }

  // Try synchronous require first — this will succeed for most CJS targets
  try {
    return dynamicRequireSync(request);
  } catch (err: any) {
    // If it's ESM, fall back to async import
    if (err && err.code === "ERR_REQUIRE_ESM") {
      // Resolve to absolute file URL then import
      let resolved: string;
      try {
        const paths = nativeRequire.resolve.paths(request) || [];
        resolved = nativeRequire.resolve(request, { paths });
      } catch (resolveErr) {
        // try relative
        const candidate = path.resolve(process.cwd(), request);
        if (fs.existsSync(candidate)) resolved = candidate;
        else throw err; // cannot resolve, rethrow
      }

      // If it's a TypeScript file, prefer to import the transpiled JS version
      if (resolved.endsWith(".ts")) {
        // If ts-node is registered, we can import the TS file via dynamic import.
        if (tsNodeRegistered) {
          return import(pathToFileURL(resolved).href);
        }

        // Otherwise transpile to CommonJS and execute (same approach as sync fallback)
        try {
          const code = fs.readFileSync(resolved, "utf8");
          const ts = getNativeRequire()("typescript");
          const transpiled = ts.transpileModule(code, {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2020,
              esModuleInterop: true,
            },
          }).outputText;

          // write to temporary file with .mjs extension and dynamic import
          const tmpDir = fs.mkdtempSync(
            path.join(process.cwd(), "./.arcanajs-scratch-")
          );
          const tmpFile = path.join(
            tmpDir,
            path.basename(resolved, ".ts") + ".mjs"
          );
          fs.writeFileSync(tmpFile, transpiled, "utf8");
          const result = await import(pathToFileURL(tmpFile).href);
          // clean up file(s)
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch (_) {}
          return result;
        } catch (e) {
          throw err; // fallback: rethrow original
        }
      }

      // For .mjs/.js ESM files just dynamic import
      return import(pathToFileURL(resolved).href);
    }

    // If error was not ESM-specific, rethrow
    throw err;
  }
}
