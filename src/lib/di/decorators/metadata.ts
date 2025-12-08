import "reflect-metadata";
import { ClassConstructor } from "../Container";
import { InjectableMetadata } from "./types";

const INJECTABLE_METADATA_KEY = "arcanajs:injectable";
const globalInjectables: InjectableMetadata[] = [];

/**
 * Set injectable metadata for a class
 */
export function setInjectableMetadata(
  target: ClassConstructor,
  metadata: InjectableMetadata
): void {
  Reflect.defineMetadata(INJECTABLE_METADATA_KEY, metadata, target);
  globalInjectables.push(metadata);
}

/**
 * Get injectable metadata for a class
 */
export function getInjectableMetadata(
  target: ClassConstructor
): InjectableMetadata | undefined {
  return Reflect.getMetadata(INJECTABLE_METADATA_KEY, target);
}

/**
 * Check if a class is injectable
 */
export function isInjectable(target: any): boolean {
  if (!target || typeof target !== "function") {
    return false;
  }
  return Reflect.hasMetadata(INJECTABLE_METADATA_KEY, target);
}

/**
 * Get all registered injectable classes
 */
export function getAllInjectables(): InjectableMetadata[] {
  return globalInjectables;
}
