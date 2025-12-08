import { ClassConstructor } from "../Container";

/**
 * Scope of the injectable class
 */
export type InjectableScope = "singleton" | "transient";

/**
 * Options for the @Injectable decorator
 */
export interface InjectableOptions {
  /**
   * Scope of the injectable class
   * - singleton: Only one instance will be created and reused
   * - transient: A new instance will be created each time it's resolved
   * @default "transient"
   */
  scope?: InjectableScope;

  /**
   * Custom key to register the class under
   * If not provided, the class constructor itself will be used as the key
   */
  key?: string;
}

/**
 * Metadata stored for each injectable class
 */
export interface InjectableMetadata {
  target: ClassConstructor;
  scope: InjectableScope;
  key?: string;
}

/**
 * Auto-discovery configuration
 */
export interface AutoDiscoveryConfig {
  /**
   * Enable auto-discovery of injectable classes
   * @default false
   */
  enabled: boolean;

  /**
   * File patterns to include
   * @default ['**\/*.ts', '**\/*.js']
   */
  include?: string[];

  /**
   * File patterns to exclude
   * @default ['**\/*.test.ts', '**\/*.spec.ts', '**\/node_modules/**']
   */
  exclude?: string[];

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}
