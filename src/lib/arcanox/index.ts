/**
 * Arcanox - Professional ORM/ODM for TypeScript
 *
 * Supports PostgreSQL, MySQL, and MongoDB with a unified API
 *
 * @module arcanox
 */

// =============================================================================
// CORE
// =============================================================================

// Model class
import { Model as ArcanoxModel } from "./Model";
export { ArcanoxModel as Model };

// Query builder
import { QueryBuilder as ArcanoxQueryBuilder } from "./QueryBuilder";
export { ArcanoxQueryBuilder as QueryBuilder };

// Types and interfaces
export * from "./types";

// =============================================================================
// RELATIONS
// =============================================================================

export {
  BelongsTo,
  BelongsToMany,
  HasMany,
  HasOne,
  MorphMany,
  MorphOne,
  MorphTo,
  Relation,
} from "./relations";

// =============================================================================
// DATABASE ADAPTERS
// =============================================================================

export { MongoAdapter, MySQLAdapter, PostgresAdapter } from "./adapters";

// =============================================================================
// SCHEMA & MIGRATIONS
// =============================================================================

export {
  Blueprint,
  CheckConstraintBuilder,
  ColumnBuilder,
  ForeignKeyBuilder,
  Migration,
  MigrationRunner,
  Schema,
} from "./schema";
export type {
  ColumnModifier,
  IndexDefinition,
  MigrationRecord,
  MigrationStatus,
} from "./schema";

// =============================================================================
// SUPPORT UTILITIES
// =============================================================================

export {
  ConnectionManager,
  ConnectionState,
  DB,
  Logger,
  Macroable,
  QueryExplainer,
  QueryLogger,
  QueryProfiler,
} from "./support";
export type {
  ConnectionEvent,
  ConnectionEventListener,
  ConnectionStats,
  HealthCheckResult,
  LogOutputOptions,
  ProfileResult,
  QueryAnalysis,
  QueryFormatterOptions,
  QueryLogEntry,
  QueryLogListener,
  QueryStatistics,
  QueryType,
  ReplicaConfig,
  RetryConfig,
} from "./support";

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Create a new model instance helper
 */
export function model<T extends ArcanoxModel>(ModelClass: new () => T): T {
  return new ModelClass();
}
