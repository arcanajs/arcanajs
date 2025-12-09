/**
 * Arcanox Support Utilities Exports
 */

// Macroable trait
export { Macroable } from "./Macroable";

// Connection management
export { ConnectionManager, ConnectionState, DB } from "./ConnectionManager";
export type {
  ConnectionEvent,
  ConnectionEventListener,
  ConnectionStats,
  HealthCheckResult,
  ReplicaConfig,
  RetryConfig,
} from "./ConnectionManager";

// Query logging and debugging
export {
  Logger,
  QueryExplainer,
  QueryLogger,
  QueryProfiler,
} from "./QueryLogger";
export type {
  LogOutputOptions,
  ProfileResult,
  QueryAnalysis,
  QueryFormatterOptions,
  QueryLogEntry,
  QueryLogListener,
  QueryStatistics,
  QueryType,
} from "./QueryLogger";
