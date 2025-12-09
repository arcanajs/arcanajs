import { EventEmitter } from "events";
import { MongoAdapter } from "../adapters/MongoAdapter";
import { MySQLAdapter } from "../adapters/MySQLAdapter";
import { PostgresAdapter } from "../adapters/PostgresAdapter";
import { DatabaseAdapter, DatabaseConfig } from "../types";

/**
 * Connection state enumeration
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

/**
 * Connection health check result
 */
export interface HealthCheckResult {
  connection: string;
  status: "healthy" | "unhealthy" | "degraded";
  latency: number;
  details?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  connection: string;
  driver: string;
  state: ConnectionState;
  totalQueries: number;
  failedQueries: number;
  avgResponseTime: number;
  activeConnections: number;
  poolSize: number;
  waitingClients: number;
  idleConnections: number;
  lastActivity: Date;
  uptime: number;
  reconnects: number;
}

/**
 * Connection event types
 */
export type ConnectionEvent =
  | "connected"
  | "disconnected"
  | "error"
  | "reconnecting"
  | "query"
  | "slowQuery"
  | "poolDrained"
  | "poolFull";

/**
 * Connection event listener
 */
export type ConnectionEventListener = (
  connection: string,
  data?: any
) => void | Promise<void>;

/**
 * Read replica configuration
 */
export interface ReplicaConfig {
  host: string;
  port?: number;
  weight?: number;
  name?: string;
}

/**
 * Connection retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * ConnectionManager - Professional database connection management
 * Supports multiple connections, read replicas, connection pooling, health checks
 */
export class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager;
  private connections: Map<string, DatabaseAdapter> = new Map();
  private configs: Map<string, DatabaseConfig> = new Map();
  private states: Map<string, ConnectionState> = new Map();
  private stats: Map<string, ConnectionStats> = new Map();
  private readReplicas: Map<string, DatabaseAdapter[]> = new Map();
  private defaultConnection: string = "default";
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private queryLog: Array<{
    connection: string;
    query: string;
    duration: number;
    timestamp: Date;
  }> = [];
  private maxQueryLogSize: number = 1000;
  private slowQueryThreshold: number = 1000; // ms

  private retryConfig: RetryConfig = {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  private constructor() {
    super();
    this.setMaxListeners(50);
    this.setupProcessHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    process.on("beforeExit", async () => {
      await this.disconnectAll();
    });

    process.on("SIGINT", async () => {
      await this.disconnectAll();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.disconnectAll();
      process.exit(0);
    });
  }

  /**
   * Configure connection retry settings
   */
  setRetryConfig(config: Partial<RetryConfig>): this {
    this.retryConfig = { ...this.retryConfig, ...config };
    return this;
  }

  /**
   * Configure slow query threshold
   */
  setSlowQueryThreshold(ms: number): this {
    this.slowQueryThreshold = ms;
    return this;
  }

  /**
   * Add a database connection configuration
   */
  addConnection(name: string, config: DatabaseConfig): this {
    this.configs.set(name, config);
    this.states.set(name, ConnectionState.DISCONNECTED);
    this.initStats(name, config.type);
    return this;
  }

  /**
   * Add multiple connections from config object
   */
  addConnections(
    connections: Record<string, DatabaseConfig>,
    defaultConnection?: string
  ): this {
    for (const [name, config] of Object.entries(connections)) {
      this.addConnection(name, config);
    }
    if (defaultConnection) {
      this.defaultConnection = defaultConnection;
    }
    return this;
  }

  /**
   * Set the default connection name
   */
  setDefaultConnection(name: string): this {
    if (!this.configs.has(name)) {
      throw new Error(`Connection "${name}" not configured`);
    }
    this.defaultConnection = name;
    return this;
  }

  /**
   * Get the default connection name
   */
  getDefaultConnection(): string {
    return this.defaultConnection;
  }

  /**
   * Initialize connection statistics
   */
  private initStats(name: string, driver: string): void {
    this.stats.set(name, {
      connection: name,
      driver,
      state: ConnectionState.DISCONNECTED,
      totalQueries: 0,
      failedQueries: 0,
      avgResponseTime: 0,
      activeConnections: 0,
      poolSize: 0,
      waitingClients: 0,
      idleConnections: 0,
      lastActivity: new Date(),
      uptime: 0,
      reconnects: 0,
    });
  }

  /**
   * Create adapter instance from config
   */
  private createAdapter(config: DatabaseConfig): DatabaseAdapter {
    switch (config.type) {
      case "mongodb":
        return new MongoAdapter();
      case "postgres":
        return new PostgresAdapter();
      case "mysql":
        return new MySQLAdapter();
      default:
        throw new Error(`Unsupported database driver: ${config.type}`);
    }
  }

  /**
   * Connect to a specific database
   */
  async connect(name?: string): Promise<DatabaseAdapter> {
    const connectionName = name || this.defaultConnection;
    const config = this.configs.get(connectionName);

    if (!config) {
      throw new Error(`Connection "${connectionName}" not configured`);
    }

    // Return existing connection if already connected
    const existing = this.connections.get(connectionName);
    if (
      existing &&
      this.states.get(connectionName) === ConnectionState.CONNECTED
    ) {
      return existing;
    }

    this.states.set(connectionName, ConnectionState.CONNECTING);

    try {
      const adapter = this.createAdapter(config);
      await adapter.connect(config);

      this.connections.set(connectionName, adapter);
      this.states.set(connectionName, ConnectionState.CONNECTED);
      this.updateStats(connectionName, { state: ConnectionState.CONNECTED });

      this.emit("connected", connectionName, { config });

      return adapter;
    } catch (error) {
      this.states.set(connectionName, ConnectionState.FAILED);
      this.updateStats(connectionName, { state: ConnectionState.FAILED });
      this.emit("error", connectionName, { error });
      throw error;
    }
  }

  /**
   * Connect all configured databases
   */
  async connectAll(): Promise<Map<string, DatabaseAdapter>> {
    const results = new Map<string, DatabaseAdapter>();
    const errors: Array<{ name: string; error: Error }> = [];

    await Promise.all(
      Array.from(this.configs.keys()).map(async (name) => {
        try {
          const adapter = await this.connect(name);
          results.set(name, adapter);
        } catch (error) {
          errors.push({ name, error: error as Error });
        }
      })
    );

    if (errors.length > 0) {
      console.warn(
        `Some connections failed: ${errors.map((e) => e.name).join(", ")}`
      );
    }

    return results;
  }

  /**
   * Get a database connection
   */
  connection(name?: string): DatabaseAdapter {
    const connectionName = name || this.defaultConnection;
    const adapter = this.connections.get(connectionName);

    if (!adapter) {
      throw new Error(
        `Connection "${connectionName}" not established. Call connect() first.`
      );
    }

    if (this.states.get(connectionName) !== ConnectionState.CONNECTED) {
      throw new Error(
        `Connection "${connectionName}" is not in connected state`
      );
    }

    return adapter;
  }

  /**
   * Get connection or connect if not connected
   */
  async getConnection(name?: string): Promise<DatabaseAdapter> {
    const connectionName = name || this.defaultConnection;

    if (this.states.get(connectionName) === ConnectionState.CONNECTED) {
      return this.connection(connectionName);
    }

    return this.connect(connectionName);
  }

  /**
   * Disconnect a specific connection
   */
  async disconnect(name?: string): Promise<void> {
    const connectionName = name || this.defaultConnection;
    const adapter = this.connections.get(connectionName);

    if (adapter) {
      await adapter.disconnect();
      this.connections.delete(connectionName);
      this.states.set(connectionName, ConnectionState.DISCONNECTED);
      this.updateStats(connectionName, { state: ConnectionState.DISCONNECTED });
      this.emit("disconnected", connectionName);
    }

    // Clear retry timer if any
    const timer = this.retryTimers.get(connectionName);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(connectionName);
    }
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    // Clear all health check intervals
    for (const [name, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(name);
    }

    // Disconnect all
    await Promise.all(
      Array.from(this.connections.keys()).map((name) => this.disconnect(name))
    );
  }

  /**
   * Reconnect to a database
   */
  async reconnect(name?: string): Promise<DatabaseAdapter> {
    const connectionName = name || this.defaultConnection;

    await this.disconnect(connectionName);
    return this.connect(connectionName);
  }

  /**
   * Reconnect with retry logic
   */
  async reconnectWithRetry(
    name?: string,
    retries: number = 0
  ): Promise<DatabaseAdapter> {
    const connectionName = name || this.defaultConnection;

    this.states.set(connectionName, ConnectionState.RECONNECTING);
    this.emit("reconnecting", connectionName, { attempt: retries + 1 });

    try {
      const adapter = await this.connect(connectionName);
      this.updateStats(connectionName, (stats) => ({
        reconnects: stats.reconnects + 1,
      }));
      return adapter;
    } catch (error) {
      if (retries < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.initialDelay *
            Math.pow(this.retryConfig.backoffMultiplier, retries),
          this.retryConfig.maxDelay
        );

        return new Promise((resolve, reject) => {
          const timer = setTimeout(async () => {
            try {
              const adapter = await this.reconnectWithRetry(
                connectionName,
                retries + 1
              );
              resolve(adapter);
            } catch (err) {
              reject(err);
            }
          }, delay);

          this.retryTimers.set(connectionName, timer);
        });
      }

      this.states.set(connectionName, ConnectionState.FAILED);
      throw new Error(
        `Failed to reconnect to "${connectionName}" after ${this.retryConfig.maxRetries} attempts`
      );
    }
  }

  /**
   * Add read replicas for a connection
   */
  async addReadReplicas(
    name: string,
    replicas: ReplicaConfig[]
  ): Promise<void> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Connection "${name}" not configured`);
    }

    const replicaAdapters: DatabaseAdapter[] = [];

    for (const replica of replicas) {
      const replicaConfig: DatabaseConfig = {
        ...config,
        host: replica.host,
        port: replica.port || config.port,
      };

      const adapter = this.createAdapter(replicaConfig);
      await adapter.connect(replicaConfig);
      replicaAdapters.push(adapter);
    }

    this.readReplicas.set(name, replicaAdapters);
  }

  /**
   * Get a read replica connection (round-robin selection)
   */
  getReadReplica(name?: string): DatabaseAdapter {
    const connectionName = name || this.defaultConnection;
    const replicas = this.readReplicas.get(connectionName);

    if (!replicas || replicas.length === 0) {
      // Fall back to main connection if no replicas
      return this.connection(connectionName);
    }

    // Simple round-robin selection
    const index = Math.floor(Math.random() * replicas.length);
    return replicas[index];
  }

  /**
   * Check connection health
   */
  async healthCheck(name?: string): Promise<HealthCheckResult> {
    const connectionName = name || this.defaultConnection;
    const adapter = this.connections.get(connectionName);
    const startTime = Date.now();

    if (!adapter) {
      return {
        connection: connectionName,
        status: "unhealthy",
        latency: 0,
        error: "Connection not established",
        timestamp: new Date(),
      };
    }

    try {
      // Execute a simple query to check connectivity
      if (adapter instanceof MongoAdapter) {
        await (adapter as any).client?.db().command({ ping: 1 });
      } else {
        await adapter.raw("SELECT 1");
      }

      const latency = Date.now() - startTime;

      return {
        connection: connectionName,
        status: latency > this.slowQueryThreshold ? "degraded" : "healthy",
        latency,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        connection: connectionName,
        status: "unhealthy",
        latency: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check health of all connections
   */
  async healthCheckAll(): Promise<HealthCheckResult[]> {
    return Promise.all(
      Array.from(this.connections.keys()).map((name) => this.healthCheck(name))
    );
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(interval: number = 30000, name?: string): void {
    const connectionName = name || this.defaultConnection;

    // Clear existing interval
    const existing = this.healthCheckIntervals.get(connectionName);
    if (existing) {
      clearInterval(existing);
    }

    const intervalId = setInterval(async () => {
      const result = await this.healthCheck(connectionName);

      if (result.status === "unhealthy") {
        this.emit("error", connectionName, { healthCheck: result });
        // Attempt reconnect
        try {
          await this.reconnectWithRetry(connectionName);
        } catch (error) {
          console.error(`Failed to reconnect "${connectionName}":`, error);
        }
      }
    }, interval);

    this.healthCheckIntervals.set(connectionName, intervalId);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(name?: string): void {
    if (name) {
      const interval = this.healthCheckIntervals.get(name);
      if (interval) {
        clearInterval(interval);
        this.healthCheckIntervals.delete(name);
      }
    } else {
      for (const [name, interval] of this.healthCheckIntervals) {
        clearInterval(interval);
        this.healthCheckIntervals.delete(name);
      }
    }
  }

  /**
   * Update connection statistics
   */
  private updateStats(
    name: string,
    update:
      | Partial<ConnectionStats>
      | ((stats: ConnectionStats) => Partial<ConnectionStats>)
  ): void {
    const current = this.stats.get(name);
    if (current) {
      const updates = typeof update === "function" ? update(current) : update;
      this.stats.set(name, {
        ...current,
        ...updates,
        lastActivity: new Date(),
      });
    }
  }

  /**
   * Get connection statistics
   */
  getStats(name?: string): ConnectionStats | undefined {
    return this.stats.get(name || this.defaultConnection);
  }

  /**
   * Get all connection statistics
   */
  getAllStats(): ConnectionStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Log a query execution
   */
  logQuery(connection: string, query: string, duration: number): void {
    this.queryLog.push({
      connection,
      query,
      duration,
      timestamp: new Date(),
    });

    // Trim log if too large
    if (this.queryLog.length > this.maxQueryLogSize) {
      this.queryLog = this.queryLog.slice(-this.maxQueryLogSize);
    }

    // Update stats
    this.updateStats(connection, (stats) => {
      const totalQueries = stats.totalQueries + 1;
      const avgResponseTime =
        (stats.avgResponseTime * stats.totalQueries + duration) / totalQueries;
      return { totalQueries, avgResponseTime };
    });

    // Emit event
    this.emit("query", connection, { query, duration });

    // Check for slow query
    if (duration > this.slowQueryThreshold) {
      this.emit("slowQuery", connection, { query, duration });
    }
  }

  /**
   * Get query log
   */
  getQueryLog(
    options: {
      connection?: string;
      limit?: number;
      minDuration?: number;
    } = {}
  ): Array<{
    connection: string;
    query: string;
    duration: number;
    timestamp: Date;
  }> {
    let log = [...this.queryLog];

    if (options.connection) {
      log = log.filter((entry) => entry.connection === options.connection);
    }

    if (options.minDuration !== undefined) {
      const minDuration = options.minDuration;
      log = log.filter((entry) => entry.duration >= minDuration);
    }

    if (options.limit) {
      log = log.slice(-options.limit);
    }

    return log;
  }

  /**
   * Clear query log
   */
  clearQueryLog(): void {
    this.queryLog = [];
  }

  /**
   * Execute query on connection with logging
   */
  async query<T = any>(
    sql: string,
    params?: any[],
    connection?: string
  ): Promise<T> {
    const connectionName = connection || this.defaultConnection;
    const adapter = await this.getConnection(connectionName);

    const startTime = Date.now();
    try {
      const result = await adapter.raw(sql, params);
      this.logQuery(connectionName, sql, Date.now() - startTime);
      return result as T;
    } catch (error) {
      this.updateStats(connectionName, (stats) => ({
        failedQueries: stats.failedQueries + 1,
      }));
      throw error;
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(connection?: string): Promise<void> {
    const adapter = await this.getConnection(connection);
    await adapter.beginTransaction();
  }

  /**
   * Commit a transaction
   */
  async commit(connection?: string): Promise<void> {
    const adapter = await this.getConnection(connection);
    await adapter.commit();
  }

  /**
   * Rollback a transaction
   */
  async rollback(connection?: string): Promise<void> {
    const adapter = await this.getConnection(connection);
    await adapter.rollback();
  }

  /**
   * Execute callback within a transaction
   */
  async transaction<T>(
    callback: (adapter: DatabaseAdapter) => Promise<T>,
    connection?: string
  ): Promise<T> {
    const adapter = await this.getConnection(connection);

    await adapter.beginTransaction();
    try {
      const result = await callback(adapter);
      await adapter.commit();
      return result;
    } catch (error) {
      await adapter.rollback();
      throw error;
    }
  }

  /**
   * Get connection state
   */
  getState(name?: string): ConnectionState {
    return (
      this.states.get(name || this.defaultConnection) ||
      ConnectionState.DISCONNECTED
    );
  }

  /**
   * Check if connection is connected
   */
  isConnected(name?: string): boolean {
    return this.getState(name) === ConnectionState.CONNECTED;
  }

  /**
   * Get all connection names
   */
  getConnectionNames(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Check if a connection is configured
   */
  hasConnection(name: string): boolean {
    return this.configs.has(name);
  }

  /**
   * Remove a connection configuration
   */
  async removeConnection(name: string): Promise<void> {
    await this.disconnect(name);
    this.configs.delete(name);
    this.states.delete(name);
    this.stats.delete(name);
    this.readReplicas.delete(name);
  }

  /**
   * Purge and reset all connections
   */
  async purge(): Promise<void> {
    await this.disconnectAll();
    this.connections.clear();
    this.configs.clear();
    this.states.clear();
    this.stats.clear();
    this.readReplicas.clear();
    this.queryLog = [];
  }

  /**
   * Create a savepoint in the current transaction
   */
  async savepoint(name: string, connection?: string): Promise<void> {
    const adapter = await this.getConnection(connection);
    await adapter.raw(`SAVEPOINT ${name}`);
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackToSavepoint(name: string, connection?: string): Promise<void> {
    const adapter = await this.getConnection(connection);
    await adapter.raw(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(name: string, connection?: string): Promise<void> {
    const adapter = await this.getConnection(connection);
    await adapter.raw(`RELEASE SAVEPOINT ${name}`);
  }

  /**
   * Get database version information
   */
  async getDatabaseVersion(connection?: string): Promise<string> {
    const connectionName = connection || this.defaultConnection;
    const config = this.configs.get(connectionName);
    const adapter = await this.getConnection(connectionName);

    switch (config?.type) {
      case "postgres":
        const pgResult = await adapter.raw("SELECT version()");
        return pgResult[0]?.version || "unknown";
      case "mysql":
        const mysqlResult = await adapter.raw("SELECT VERSION() as version");
        return mysqlResult[0]?.version || "unknown";
      case "mongodb":
        // For MongoDB, version would be obtained differently
        return "MongoDB";
      default:
        return "unknown";
    }
  }

  /**
   * Extend connection manager with custom functionality
   */
  extend(name: string, callback: (manager: ConnectionManager) => void): this {
    callback(this);
    return this;
  }
}

// Export singleton instance getter
export const DB = () => ConnectionManager.getInstance();
