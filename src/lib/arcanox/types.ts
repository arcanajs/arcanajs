/**
 * Arcanox ORM/ODM Types
 * Professional database abstraction layer supporting PostgreSQL, MySQL, and MongoDB
 */

// =============================================================================
// CONNECTION TYPES
// =============================================================================

/**
 * Database connection interface
 */
export interface Connection {
  query(sql: string, params?: any[]): Promise<any>;
  execute(sql: string, params?: any[]): Promise<any>;
  close(): Promise<void>;
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
  active: number;
}

/**
 * Connection events for monitoring
 */
export interface ConnectionEvents {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onQuery?: (
    query: string,
    params: any[] | undefined,
    duration: number
  ) => void;
  onSlowQuery?: (
    query: string,
    params: any[] | undefined,
    duration: number
  ) => void;
}

// =============================================================================
// DATABASE ADAPTER INTERFACE
// =============================================================================

/**
 * Database adapter interface - implements database-specific operations
 */
export interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<Connection>;
  disconnect(): Promise<void>;

  // Schema operations
  createTable(tableName: string, columns: ColumnDefinition[]): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  hasTable(tableName: string): Promise<boolean>;
  hasColumn(tableName: string, columnName: string): Promise<boolean>;
  renameTable?(from: string, to: string): Promise<void>;
  addColumn?(tableName: string, column: ColumnDefinition): Promise<void>;
  dropColumn?(tableName: string, columnName: string): Promise<void>;
  renameColumn?(tableName: string, from: string, to: string): Promise<void>;
  modifyColumn?(tableName: string, column: ColumnDefinition): Promise<void>;

  // Index operations
  createIndex?(
    tableName: string,
    columns: string[],
    options?: IndexOptions
  ): Promise<void>;
  dropIndex?(tableName: string, indexName: string): Promise<void>;
  getIndexes?(tableName: string): Promise<IndexInfo[]>;

  // Query operations
  select(table: string, options: SelectOptions): Promise<any[]>;
  insert(table: string, data: Record<string, any>): Promise<any>;
  insertMany?(table: string, data: Record<string, any>[]): Promise<any[]>;
  update(table: string, id: any, data: Record<string, any>): Promise<any>;
  updateMany?(
    table: string,
    where: WhereClause[],
    data: Record<string, any>
  ): Promise<number>;
  delete(table: string, id: any): Promise<boolean>;
  deleteMany?(table: string, where: WhereClause[]): Promise<number>;
  upsert?(
    table: string,
    data: Record<string, any>,
    uniqueKeys: string[]
  ): Promise<any>;

  // Transaction support
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  transaction?<T>(
    callback: (adapter: DatabaseAdapter) => Promise<T>
  ): Promise<T>;

  // Raw query support
  raw(query: string, params?: any[]): Promise<any>;

  // Aggregate operations (MongoDB-specific but available for SQL)
  aggregate?(table: string, pipeline: AggregateStage[]): Promise<any[]>;
  count?(table: string, where?: WhereClause[]): Promise<number>;
  distinct?(
    table: string,
    column: string,
    where?: WhereClause[]
  ): Promise<any[]>;

  // Connection pool management
  getPoolStats?(): PoolStats;
  ping?(): Promise<boolean>;
}

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

/**
 * Supported database types
 */
export type DatabaseType =
  | "postgres"
  | "mysql"
  | "mongodb"
  | "sqlite"
  | "mariadb";

/**
 * SSL/TLS configuration options
 */
export interface SSLConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

/**
 * Connection pool configuration
 */
export interface PoolConfig {
  min?: number;
  max?: number;
  acquireTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
  propagateCreateError?: boolean;
}

/**
 * Read replica configuration for read scaling
 */
export interface ReplicaConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  weight?: number;
}

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  // Connection type
  type: DatabaseType;

  // Connection details
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;

  // Connection string (alternative to host/port)
  url?: string;
  uri?: string;

  // SSL/TLS
  ssl?: boolean | SSLConfig;

  // Connection pool
  pool?: PoolConfig;

  // Read replicas for scaling
  replicas?: ReplicaConfig[];

  // Query logging and monitoring
  logging?: boolean | LoggingConfig;
  slowQueryThreshold?: number; // in milliseconds

  // Connection options
  connectTimeout?: number;
  socketTimeout?: number;
  keepAlive?: boolean;
  keepAliveInitialDelay?: number;

  // MongoDB-specific options
  authSource?: string;
  replicaSet?: string;
  retryWrites?: boolean;
  w?: number | "majority";
  journal?: boolean;
  readPreference?:
    | "primary"
    | "primaryPreferred"
    | "secondary"
    | "secondaryPreferred"
    | "nearest";
  readConcern?:
    | "local"
    | "majority"
    | "linearizable"
    | "available"
    | "snapshot";
  writeConcern?: WriteConcernOptions;

  // PostgreSQL-specific options
  schema?: string;
  applicationName?: string;
  statementTimeout?: number;
  queryTimeout?: number;

  // MySQL-specific options
  charset?: string;
  collation?: string;
  timezone?: string;
  dateStrings?: boolean;
  multipleStatements?: boolean;

  // Event handlers
  events?: ConnectionEvents;

  // Debug mode
  debug?: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  queries?: boolean;
  errors?: boolean;
  slowQueries?: boolean;
  connections?: boolean;
  logger?: (level: string, message: string, meta?: any) => void;
}

/**
 * MongoDB write concern options
 */
export interface WriteConcernOptions {
  w?: number | "majority";
  j?: boolean;
  wtimeout?: number;
}

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

/**
 * Column/Field definition
 */
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  default?: any;
  unique?: boolean;
  primary?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  comment?: string;
  after?: string;
  first?: boolean;
  collation?: string;
  charset?: string;
  generated?: GeneratedColumnOptions;
  check?: string;
  index?: string;
  values?: string[];
  subtype?: string;
  srid?: number;
  elementType?: string;
}

/**
 * Supported column types
 */
export type ColumnType =
  // Numeric types
  | "integer"
  | "int"
  | "smallint"
  | "bigint"
  | "tinyint"
  | "mediumint"
  | "tinyInteger"
  | "smallInteger"
  | "mediumInteger"
  | "bigInteger"
  | "decimal"
  | "numeric"
  | "float"
  | "double"
  | "real"
  | "money"
  // String types
  | "string"
  | "varchar"
  | "char"
  | "text"
  | "mediumtext"
  | "longtext"
  | "tinytext"
  | "mediumText"
  | "longText"
  | "tinyText"
  // Binary types
  | "binary"
  | "varbinary"
  | "blob"
  | "mediumblob"
  | "longblob"
  | "tinyblob"
  | "mediumBlob"
  | "longBlob"
  | "tinyBlob"
  | "bytea"
  // Date/Time types
  | "date"
  | "datetime"
  | "datetimeTz"
  | "timestamp"
  | "timestampTz"
  | "time"
  | "timeTz"
  | "year"
  | "interval"
  // Boolean
  | "boolean"
  | "bool"
  // JSON
  | "json"
  | "jsonb"
  // UUID & ID
  | "uuid"
  | "objectId"
  | "ulid"
  // Array types
  | "array"
  | "object"
  | "mixed"
  // Geometry types (PostGIS/MySQL)
  | "point"
  | "linestring"
  | "polygon"
  | "geometry"
  | "geography"
  | "multipoint"
  | "multilinestring"
  | "multipolygon"
  | "geometrycollection"
  // PostgreSQL-specific types
  | "inet"
  | "cidr"
  | "macaddr"
  | "macaddr8"
  | "int4range"
  | "int8range"
  | "numrange"
  | "tsrange"
  | "tstzrange"
  | "daterange"
  | "tsvector"
  | "tsquery"
  | "xml"
  | "hstore"
  | "bit"
  | "varbit"
  // Enum and Set
  | "enum"
  | "set"
  // Computed column
  | "computed";

/**
 * Generated column options
 */
export interface GeneratedColumnOptions {
  type: "STORED" | "VIRTUAL";
  expression: string;
}

/**
 * Index options
 */
export interface IndexOptions {
  name?: string;
  unique?: boolean;
  type?: "BTREE" | "HASH" | "GIST" | "GIN" | "SPGIST" | "BRIN";
  where?: string;
  includes?: string[];
  // MongoDB-specific
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, any>;
  collation?: Record<string, any>;
  // Text index options
  weights?: Record<string, number>;
  defaultLanguage?: string;
  languageOverride?: string;
}

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
  primary?: boolean;
}

// =============================================================================
// QUERY BUILDING TYPES
// =============================================================================

/**
 * Select query options
 */
export interface SelectOptions {
  columns?: string[];
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  groupBy?: string[];
  having?: WhereClause[];
  limit?: number;
  offset?: number;
  joins?: JoinClause[];
  distinct?: boolean;
  forUpdate?: boolean;
  forShare?: boolean;
  skipLocked?: boolean;
  noWait?: boolean;
}

/**
 * WHERE clause operators
 */
export type WhereOperator =
  | "="
  | "!="
  | "<>"
  | ">"
  | "<"
  | ">="
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "ILIKE"
  | "NOT ILIKE"
  | "IN"
  | "NOT IN"
  | "BETWEEN"
  | "NOT BETWEEN"
  | "IS NULL"
  | "IS NOT NULL"
  | "EXISTS"
  | "NOT EXISTS"
  | "REGEXP"
  | "NOT REGEXP"
  | "SIMILAR TO"
  | "NOT SIMILAR TO"
  // Array operators (PostgreSQL)
  | "@>"
  | "<@"
  | "&&"
  | "||"
  // JSON operators
  | "->"
  | "->>"
  | "#>"
  | "#>>"
  | "?"
  | "?|"
  | "?&"
  | "@?"
  // Full-text search
  | "@@"
  | "MATCH";

/**
 * WHERE clause definition
 */
export interface WhereClause {
  column: string;
  operator: WhereOperator;
  value: any;
  boolean?: "AND" | "OR";
  not?: boolean;
  nested?: WhereClause[];
  raw?: boolean;
}

/**
 * ORDER BY clause definition
 */
export interface OrderByClause {
  column: string;
  direction: "ASC" | "DESC";
  nulls?: "FIRST" | "LAST";
}

/**
 * JOIN clause definition
 */
export interface JoinClause {
  type: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";
  table: string;
  first: string;
  operator: string;
  second: string;
  alias?: string;
  lateral?: boolean;
  conditions?: WhereClause[];
}

// =============================================================================
// AGGREGATE PIPELINE (MongoDB-style, but works for SQL too)
// =============================================================================

/**
 * Aggregate pipeline stage types
 */
export type AggregateStage =
  | MatchStage
  | GroupStage
  | SortStage
  | ProjectStage
  | LimitStage
  | SkipStage
  | UnwindStage
  | LookupStage
  | AddFieldsStage
  | CountStage
  | BucketStage
  | FacetStage
  | OutStage
  | MergeStage;

export interface MatchStage {
  $match: Record<string, any>;
}

export interface GroupStage {
  $group: {
    _id: any;
    [key: string]: any;
  };
}

export interface SortStage {
  $sort: Record<string, 1 | -1>;
}

export interface ProjectStage {
  $project: Record<string, 0 | 1 | any>;
}

export interface LimitStage {
  $limit: number;
}

export interface SkipStage {
  $skip: number;
}

export interface UnwindStage {
  $unwind:
    | string
    | {
        path: string;
        preserveNullAndEmptyArrays?: boolean;
        includeArrayIndex?: string;
      };
}

export interface LookupStage {
  $lookup: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
    let?: Record<string, any>;
    pipeline?: AggregateStage[];
  };
}

export interface AddFieldsStage {
  $addFields: Record<string, any>;
}

export interface CountStage {
  $count: string;
}

export interface BucketStage {
  $bucket: {
    groupBy: any;
    boundaries: any[];
    default?: any;
    output?: Record<string, any>;
  };
}

export interface FacetStage {
  $facet: Record<string, AggregateStage[]>;
}

export interface OutStage {
  $out:
    | string
    | {
        db: string;
        coll: string;
      };
}

export interface MergeStage {
  $merge: {
    into: string | { db: string; coll: string };
    on?: string | string[];
    whenMatched?:
      | "replace"
      | "keepExisting"
      | "merge"
      | "fail"
      | AggregateStage[];
    whenNotMatched?: "insert" | "discard" | "fail";
  };
}

// =============================================================================
// MODEL TYPES
// =============================================================================

/**
 * Model event types for hooks
 */
export type ModelEvent =
  | "creating"
  | "created"
  | "updating"
  | "updated"
  | "saving"
  | "saved"
  | "deleting"
  | "deleted"
  | "restoring"
  | "restored"
  | "forceDeleting"
  | "forceDeleted"
  | "retrieved"
  | "replicating";

/**
 * Model hook callback
 */
export type ModelHook<T = any> = (
  model: T
) => void | boolean | Promise<void | boolean>;

/**
 * Attribute cast types
 */
export type CastType =
  | "string"
  | "integer"
  | "int"
  | "float"
  | "double"
  | "decimal"
  | "boolean"
  | "bool"
  | "object"
  | "array"
  | "json"
  | "collection"
  | "date"
  | "datetime"
  | "timestamp"
  | "immutable_date"
  | "immutable_datetime"
  | "encrypted"
  | "hashed"
  | "objectId"
  | `decimal:${number}`
  | `datetime:${string}`
  | `date:${string}`
  | `enum:${string}`;

/**
 * Scope definition
 */
export interface ScopeDefinition {
  name: string;
  apply: (query: any, ...args: any[]) => any;
}

/**
 * Pagination result
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number;
  to: number;
  hasMorePages: boolean;
  isEmpty: boolean;
  isNotEmpty: boolean;
}

/**
 * Cursor pagination result
 */
export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  perPage: number;
}

// =============================================================================
// RELATION TYPES
// =============================================================================

/**
 * Relation type enum
 */
export type RelationType =
  | "hasOne"
  | "hasMany"
  | "belongsTo"
  | "belongsToMany"
  | "morphOne"
  | "morphMany"
  | "morphTo"
  | "morphToMany"
  | "morphedByMany"
  | "hasManyThrough"
  | "hasOneThrough";

/**
 * Relation configuration
 */
export interface RelationConfig {
  type: RelationType;
  related: any;
  foreignKey?: string;
  localKey?: string;
  ownerKey?: string;
  pivotTable?: string;
  pivotForeignKey?: string;
  pivotRelatedKey?: string;
  morphName?: string;
  morphType?: string;
  through?: any;
  firstKey?: string;
  secondKey?: string;
  secondLocalKey?: string;
}

/**
 * Pivot table data
 */
export interface PivotData {
  [key: string]: any;
}

// =============================================================================
// TRANSACTION TYPES
// =============================================================================

/**
 * Transaction isolation levels
 */
export type IsolationLevel =
  | "READ UNCOMMITTED"
  | "READ COMMITTED"
  | "REPEATABLE READ"
  | "SERIALIZABLE";

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  timeout?: number;
}
