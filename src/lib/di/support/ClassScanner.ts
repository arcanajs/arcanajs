import fs from "node:fs";
import path from "node:path";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import { ClassConstructor } from "../../di/Container";
import {
  getInjectableMetadata,
  isInjectable,
} from "../../di/decorators/metadata";
import { InjectableMetadata } from "../../di/decorators/types";

export interface ScanOptions {
  /**
   * Directories to scan
   */
  directories: string[];

  /**
   * File patterns to include (glob patterns)
   * @default ['**\/*.ts', '**\/*.js']
   */
  include?: string[];

  /**
   * File patterns to exclude (glob patterns)
   * @default ['**\/*.test.ts', '**\/*.spec.ts', '**\/node_modules/**']
   */
  exclude?: string[];

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Scans directories for classes decorated with @Injectable and related decorators
 */
export class ClassScanner {
  private readonly scannedFiles = new Set<string>();
  private tsSupportRegistered = false;

  /**
   * Scan directories and return all injectable classes
   */
  async scan(options: ScanOptions): Promise<InjectableMetadata[]> {
    const {
      directories,
      include = ["**/*.ts", "**/*.js"],
      exclude = ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
      debug = false,
    } = options;

    const injectables: InjectableMetadata[] = [];
    const root = process.cwd();

    for (const dir of directories) {
      const absoluteDir = path.isAbsolute(dir) ? dir : path.resolve(root, dir);

      if (!fs.existsSync(absoluteDir)) {
        if (debug) {
          console.warn(`[ClassScanner] Directory not found: ${absoluteDir}`);
        }
        continue;
      }

      if (debug) {
        console.log(`[ClassScanner] Scanning directory: ${absoluteDir}`);
      }

      const files = await this.scanDirectory(absoluteDir, include, exclude);

      for (const file of files) {
        if (this.scannedFiles.has(file)) continue;
        this.scannedFiles.add(file);

        try {
          const discovered = await this.scanFile(file, debug);
          injectables.push(...discovered);
        } catch (error) {
          if (debug) {
            console.error(`[ClassScanner] Error scanning file ${file}:`, error);
          }
        }
      }
    }

    if (debug) {
      console.log(
        `[ClassScanner] Found ${injectables.length} injectable classes`
      );
    }

    return injectables;
  }

  /**
   * Recursively scan a directory for files
   */
  private async scanDirectory(
    dir: string,
    include: string[],
    exclude: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        // Check exclude patterns
        if (this.matchesPatterns(fullPath, exclude)) {
          continue;
        }

        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile()) {
          // Check include patterns
          if (this.matchesPatterns(fullPath, include)) {
            files.push(fullPath);
          }
        }
      }
    };

    traverse(dir);
    return files;
  }

  /**
   * Scan a single file for injectable classes
   */
  private async scanFile(
    filePath: string,
    debug: boolean
  ): Promise<InjectableMetadata[]> {
    const injectables: InjectableMetadata[] = [];

    // Register ts-node if needed for TypeScript files
    if (filePath.endsWith(".ts") && !filePath.endsWith(".d.ts")) {
      this.registerTsSupport(filePath, debug);
    }

    try {
      // Dynamic import to load the module
      const moduleExports = ModuleLoader.require(filePath);

      // Check all exports for injectable classes
      for (const key of Object.keys(moduleExports)) {
        const exported = moduleExports[key];

        if (isInjectable(exported)) {
          const metadata = getInjectableMetadata(exported as ClassConstructor);
          if (metadata) {
            injectables.push(metadata);
            if (debug) {
              console.log(
                `[ClassScanner] Found injectable: ${exported.name} (${metadata.scope})`
              );
            }
          }
        }
      }
    } catch (error) {
      // Silently skip files that can't be imported
      if (debug) {
        console.warn(`[ClassScanner] Could not import ${filePath}:`, error);
      }
    }

    return injectables;
  }

  /**
   * Register ts-node once so Node can import TS files.
   */
  private registerTsSupport(filePath: string, debug: boolean) {
    if (this.tsSupportRegistered) return;
    this.tsSupportRegistered = ModuleLoader.registerTsNode();
  }

  /**
   * Check if a path matches any of the given patterns
   */
  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      // Simple glob matching (supports ** and *)
      const regexPattern = this.buildRegexPattern(pattern);

      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    });
  }

  private buildRegexPattern(pattern: string): string {
    const escapedDots = pattern.split(".").join(String.raw`\.`);
    const withPlaceholder = escapedDots.split("**").join("__DOUBLE_STAR__");
    const singleStars = withPlaceholder.split("*").join("[^/]*");
    return singleStars.split("__DOUBLE_STAR__").join(".*");
  }

  /**
   * Clear the scanned files cache
   */
  clear(): void {
    this.scannedFiles.clear();
  }
}
