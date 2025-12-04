// ============================================================================
// Arcanox ORM Exports
// ============================================================================

export { MongoAdapter } from "./arcanox/adapters/MongoAdapter";
export { MySQLAdapter } from "./arcanox/adapters/MySQLAdapter";
export { PostgresAdapter } from "./arcanox/adapters/PostgresAdapter";
export { Model } from "./arcanox/Model";
export { QueryBuilder } from "./arcanox/QueryBuilder";
export { BelongsTo } from "./arcanox/relations/BelongsTo";
export { BelongsToMany } from "./arcanox/relations/BelongsToMany";
export { HasMany } from "./arcanox/relations/HasMany";
export { HasOne } from "./arcanox/relations/HasOne";
export { Relation } from "./arcanox/relations/Relation";
export { Macroable } from "./arcanox/support/Macroable";
export type {
  ColumnDefinition,
  Connection,
  DatabaseAdapter,
  DatabaseConfig,
  JoinClause,
  OrderByClause,
  SelectOptions,
  WhereClause,
} from "./arcanox/types";

// ============================================================================
// Arcanox Schema & Migration Exports
// ============================================================================

export {
  Blueprint,
  Migration,
  MigrationRunner,
  Schema,
} from "./arcanox/schema";
export type { MigrationStatus } from "./arcanox/schema";

// ============================================================================
// Arcanox Seeder & Factory Exports
// ============================================================================

export { Factory } from "./arcanox/factory";
export { Seeder } from "./arcanox/seeder";

// ============================================================================
// Arcanox Extensions (must be imported to register macros)
// ============================================================================

export * from "./arcanox/extensions/MongoExtensions";

// ============================================================================
// Arcanox Providers
// ============================================================================

export { DatabaseProvider } from "./arcanox/providers/DatabaseProvider";