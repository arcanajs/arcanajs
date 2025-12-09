import { EventEmitter } from "events";

/**
 * Query log entry interface
 */
export interface QueryLogEntry {
  id: string;
  query: string;
  bindings?: any[];
  duration: number;
  timestamp: Date;
  connection: string;
  type: QueryType;
  rowCount?: number;
  affectedRows?: number;
  error?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

/**
 * Query types
 */
export type QueryType =
  | "select"
  | "insert"
  | "update"
  | "delete"
  | "raw"
  | "transaction"
  | "schema"
  | "aggregate"
  | "other";

/**
 * Query statistics
 */
export interface QueryStatistics {
  totalQueries: number;
  totalDuration: number;
  averageDuration: number;
  slowQueries: number;
  failedQueries: number;
  queriesByType: Record<QueryType, number>;
  queriesByConnection: Record<string, number>;
  peakQueriesPerSecond: number;
  lastMinuteQueries: number;
}

/**
 * Query log listener
 */
export type QueryLogListener = (entry: QueryLogEntry) => void | Promise<void>;

/**
 * Query formatter options
 */
export interface QueryFormatterOptions {
  highlight?: boolean;
  uppercase?: boolean;
  indent?: boolean;
  maxLength?: number;
}

/**
 * Log output options
 */
export interface LogOutputOptions {
  console?: boolean;
  file?: string;
  callback?: (entry: QueryLogEntry) => void;
}

/**
 * QueryLogger - Professional query logging and debugging utility
 */
export class QueryLogger extends EventEmitter {
  private static instance: QueryLogger;

  private logs: QueryLogEntry[] = [];
  private maxLogSize: number = 5000;
  private enabled: boolean = true;
  private slowQueryThreshold: number = 1000; // ms
  private logAllQueries: boolean = false;
  private logSlowQueriesOnly: boolean = false;
  private queryCounter: number = 0;
  private queryListeners: Map<string, QueryLogListener[]> = new Map();
  private outputOptions: LogOutputOptions = { console: false };
  private statistics: QueryStatistics = {
    totalQueries: 0,
    totalDuration: 0,
    averageDuration: 0,
    slowQueries: 0,
    failedQueries: 0,
    queriesByType: {} as Record<QueryType, number>,
    queriesByConnection: {},
    peakQueriesPerSecond: 0,
    lastMinuteQueries: 0,
  };

  private queriesPerSecond: number[] = [];
  private lastSecondQueries: number = 0;
  private statsInterval?: NodeJS.Timeout;
  private fileHandle?: any;

  private constructor() {
    super();
    this.setMaxListeners(100);
    this.initializeStatisticsTracking();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueryLogger {
    if (!QueryLogger.instance) {
      QueryLogger.instance = new QueryLogger();
    }
    return QueryLogger.instance;
  }

  /**
   * Initialize statistics tracking intervals
   */
  private initializeStatisticsTracking(): void {
    // Track queries per second
    this.statsInterval = setInterval(() => {
      this.queriesPerSecond.push(this.lastSecondQueries);
      if (this.queriesPerSecond.length > 60) {
        this.queriesPerSecond.shift();
      }

      if (this.lastSecondQueries > this.statistics.peakQueriesPerSecond) {
        this.statistics.peakQueriesPerSecond = this.lastSecondQueries;
      }

      this.statistics.lastMinuteQueries = this.queriesPerSecond.reduce(
        (a, b) => a + b,
        0
      );
      this.lastSecondQueries = 0;
    }, 1000);
  }

  /**
   * Enable query logging
   */
  enable(): this {
    this.enabled = true;
    return this;
  }

  /**
   * Disable query logging
   */
  disable(): this {
    this.enabled = false;
    return this;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Configure slow query threshold
   */
  setSlowQueryThreshold(ms: number): this {
    this.slowQueryThreshold = ms;
    return this;
  }

  /**
   * Set maximum log size
   */
  setMaxLogSize(size: number): this {
    this.maxLogSize = size;
    return this;
  }

  /**
   * Configure output options
   */
  setOutputOptions(options: LogOutputOptions): this {
    this.outputOptions = { ...this.outputOptions, ...options };
    return this;
  }

  /**
   * Enable logging all queries
   */
  logAll(): this {
    this.logAllQueries = true;
    this.logSlowQueriesOnly = false;
    return this;
  }

  /**
   * Enable logging only slow queries
   */
  logSlowOnly(): this {
    this.logSlowQueriesOnly = true;
    this.logAllQueries = false;
    return this;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `q_${Date.now()}_${++this.queryCounter}`;
  }

  /**
   * Detect query type from SQL
   */
  private detectQueryType(query: string): QueryType {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.startsWith("select")) return "select";
    if (normalizedQuery.startsWith("insert")) return "insert";
    if (normalizedQuery.startsWith("update")) return "update";
    if (normalizedQuery.startsWith("delete")) return "delete";
    if (
      normalizedQuery.startsWith("begin") ||
      normalizedQuery.startsWith("commit") ||
      normalizedQuery.startsWith("rollback")
    )
      return "transaction";
    if (
      normalizedQuery.startsWith("create") ||
      normalizedQuery.startsWith("alter") ||
      normalizedQuery.startsWith("drop")
    )
      return "schema";

    // Check for aggregate functions
    if (
      normalizedQuery.includes("count(") ||
      normalizedQuery.includes("sum(") ||
      normalizedQuery.includes("avg(") ||
      normalizedQuery.includes("max(") ||
      normalizedQuery.includes("min(") ||
      normalizedQuery.includes("group by")
    ) {
      return "aggregate";
    }

    return "other";
  }

  /**
   * Log a query
   */
  log(
    query: string,
    options: {
      bindings?: any[];
      duration: number;
      connection?: string;
      rowCount?: number;
      affectedRows?: number;
      error?: Error;
      metadata?: Record<string, any>;
    }
  ): QueryLogEntry {
    if (!this.enabled) {
      return {} as QueryLogEntry;
    }

    const isSlow = options.duration >= this.slowQueryThreshold;

    // Skip if only logging slow queries and this isn't slow
    if (this.logSlowQueriesOnly && !isSlow && !options.error) {
      return {} as QueryLogEntry;
    }

    const entry: QueryLogEntry = {
      id: this.generateId(),
      query,
      bindings: options.bindings,
      duration: options.duration,
      timestamp: new Date(),
      connection: options.connection || "default",
      type: this.detectQueryType(query),
      rowCount: options.rowCount,
      affectedRows: options.affectedRows,
      error: options.error?.message,
      stack: options.error?.stack,
      metadata: options.metadata,
    };

    // Add to logs
    this.logs.push(entry);

    // Trim logs if over max size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Update statistics
    this.updateStatistics(entry, isSlow);

    // Track queries per second
    this.lastSecondQueries++;

    // Emit events
    this.emit("query", entry);

    if (isSlow) {
      this.emit("slowQuery", entry);
    }

    if (options.error) {
      this.emit("error", entry);
    }

    // Output
    this.output(entry, isSlow);

    return entry;
  }

  /**
   * Update statistics
   */
  private updateStatistics(entry: QueryLogEntry, isSlow: boolean): void {
    this.statistics.totalQueries++;
    this.statistics.totalDuration += entry.duration;
    this.statistics.averageDuration =
      this.statistics.totalDuration / this.statistics.totalQueries;

    if (isSlow) {
      this.statistics.slowQueries++;
    }

    if (entry.error) {
      this.statistics.failedQueries++;
    }

    // By type
    this.statistics.queriesByType[entry.type] =
      (this.statistics.queriesByType[entry.type] || 0) + 1;

    // By connection
    this.statistics.queriesByConnection[entry.connection] =
      (this.statistics.queriesByConnection[entry.connection] || 0) + 1;
  }

  /**
   * Output log entry
   */
  private output(entry: QueryLogEntry, isSlow: boolean): void {
    if (this.outputOptions.console) {
      this.outputToConsole(entry, isSlow);
    }

    if (this.outputOptions.callback) {
      this.outputOptions.callback(entry);
    }
  }

  /**
   * Output to console
   */
  private outputToConsole(entry: QueryLogEntry, isSlow: boolean): void {
    const color = entry.error ? "\x1b[31m" : isSlow ? "\x1b[33m" : "\x1b[36m";
    const reset = "\x1b[0m";
    const prefix = entry.error ? "ERROR" : isSlow ? "SLOW" : "QUERY";

    console.log(
      `${color}[${prefix}]${reset} [${entry.connection}] ${entry.duration}ms`
    );
    console.log(`  ${this.formatQuery(entry.query, { maxLength: 200 })}`);

    if (entry.bindings && entry.bindings.length > 0) {
      console.log(`  Bindings: ${JSON.stringify(entry.bindings)}`);
    }

    if (entry.error) {
      console.log(`  ${color}Error: ${entry.error}${reset}`);
    }
  }

  /**
   * Format query for display
   */
  formatQuery(query: string, options: QueryFormatterOptions = {}): string {
    let formatted = query.trim();

    // Uppercase SQL keywords
    if (options.uppercase) {
      const keywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "AND",
        "OR",
        "JOIN",
        "LEFT",
        "RIGHT",
        "INNER",
        "OUTER",
        "ON",
        "INSERT",
        "INTO",
        "VALUES",
        "UPDATE",
        "SET",
        "DELETE",
        "ORDER BY",
        "GROUP BY",
        "HAVING",
        "LIMIT",
        "OFFSET",
        "AS",
        "IN",
        "NOT",
        "NULL",
        "IS",
        "LIKE",
        "BETWEEN",
        "EXISTS",
        "UNION",
        "ALL",
        "DISTINCT",
        "CREATE",
        "ALTER",
        "DROP",
        "TABLE",
        "INDEX",
        "PRIMARY",
        "KEY",
        "FOREIGN",
        "REFERENCES",
        "CASCADE",
        "BEGIN",
        "COMMIT",
        "ROLLBACK",
      ];

      keywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        formatted = formatted.replace(regex, keyword.toUpperCase());
      });
    }

    // Truncate if too long
    if (options.maxLength && formatted.length > options.maxLength) {
      formatted = formatted.substring(0, options.maxLength) + "...";
    }

    return formatted;
  }

  /**
   * Get all logs
   */
  getLogs(): QueryLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get slow query logs
   */
  getSlowQueries(): QueryLogEntry[] {
    return this.logs.filter((log) => log.duration >= this.slowQueryThreshold);
  }

  /**
   * Get error logs
   */
  getErrorLogs(): QueryLogEntry[] {
    return this.logs.filter((log) => log.error);
  }

  /**
   * Get logs by type
   */
  getLogsByType(type: QueryType): QueryLogEntry[] {
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * Get logs by connection
   */
  getLogsByConnection(connection: string): QueryLogEntry[] {
    return this.logs.filter((log) => log.connection === connection);
  }

  /**
   * Get logs within time range
   */
  getLogsByTimeRange(start: Date, end: Date): QueryLogEntry[] {
    return this.logs.filter(
      (log) => log.timestamp >= start && log.timestamp <= end
    );
  }

  /**
   * Search logs by query pattern
   */
  searchLogs(pattern: string | RegExp): QueryLogEntry[] {
    const regex =
      typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
    return this.logs.filter((log) => regex.test(log.query));
  }

  /**
   * Get statistics
   */
  getStatistics(): QueryStatistics {
    return { ...this.statistics };
  }

  /**
   * Get top N slowest queries
   */
  getSlowestQueries(n: number = 10): QueryLogEntry[] {
    return [...this.logs].sort((a, b) => b.duration - a.duration).slice(0, n);
  }

  /**
   * Get most frequent queries
   */
  getMostFrequentQueries(
    n: number = 10
  ): Array<{ query: string; count: number; avgDuration: number }> {
    const frequency: Record<string, { count: number; totalDuration: number }> =
      {};

    this.logs.forEach((log) => {
      const normalizedQuery = log.query.trim();
      if (!frequency[normalizedQuery]) {
        frequency[normalizedQuery] = { count: 0, totalDuration: 0 };
      }
      frequency[normalizedQuery].count++;
      frequency[normalizedQuery].totalDuration += log.duration;
    });

    return Object.entries(frequency)
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      totalQueries: 0,
      totalDuration: 0,
      averageDuration: 0,
      slowQueries: 0,
      failedQueries: 0,
      queriesByType: {} as Record<QueryType, number>,
      queriesByConnection: {},
      peakQueriesPerSecond: 0,
      lastMinuteQueries: 0,
    };
    this.queriesPerSecond = [];
    this.lastSecondQueries = 0;
  }

  /**
   * Export logs to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(
      {
        logs: this.logs,
        statistics: this.statistics,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Generate report
   */
  generateReport(): string {
    const stats = this.getStatistics();
    const slowest = this.getSlowestQueries(5);
    const frequent = this.getMostFrequentQueries(5);

    let report = `
================================================================================
                           QUERY LOGGER REPORT
================================================================================

SUMMARY
-------
Total Queries: ${stats.totalQueries}
Total Duration: ${(stats.totalDuration / 1000).toFixed(2)}s
Average Duration: ${stats.averageDuration.toFixed(2)}ms
Slow Queries (>${this.slowQueryThreshold}ms): ${stats.slowQueries}
Failed Queries: ${stats.failedQueries}
Peak QPS: ${stats.peakQueriesPerSecond}
Last Minute Queries: ${stats.lastMinuteQueries}

QUERIES BY TYPE
---------------
`;

    Object.entries(stats.queriesByType).forEach(([type, count]) => {
      report += `${type.padEnd(15)}: ${count}\n`;
    });

    report += `
QUERIES BY CONNECTION
---------------------
`;

    Object.entries(stats.queriesByConnection).forEach(([conn, count]) => {
      report += `${conn.padEnd(15)}: ${count}\n`;
    });

    report += `
TOP 5 SLOWEST QUERIES
---------------------
`;

    slowest.forEach((log, i) => {
      report += `${i + 1}. ${log.duration}ms - ${log.query.substring(
        0,
        80
      )}...\n`;
    });

    report += `
TOP 5 MOST FREQUENT QUERIES
---------------------------
`;

    frequent.forEach((item, i) => {
      report += `${i + 1}. ${item.count} times (avg: ${item.avgDuration.toFixed(
        2
      )}ms) - ${item.query.substring(0, 60)}...\n`;
    });

    report += `
================================================================================
Generated at: ${new Date().toISOString()}
================================================================================
`;

    return report;
  }

  /**
   * Create a query profiler
   */
  startProfiling(label: string = "Profile"): QueryProfiler {
    return new QueryProfiler(this, label);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    this.removeAllListeners();
    this.logs = [];
  }
}

/**
 * Query Profiler - Profile a set of queries
 */
export class QueryProfiler {
  private logger: QueryLogger;
  private label: string;
  private startTime: number;
  private entries: QueryLogEntry[] = [];
  private queryHandler: (entry: QueryLogEntry) => void;

  constructor(logger: QueryLogger, label: string) {
    this.logger = logger;
    this.label = label;
    this.startTime = Date.now();

    this.queryHandler = (entry: QueryLogEntry) => {
      this.entries.push(entry);
    };

    this.logger.on("query", this.queryHandler);
  }

  /**
   * Stop profiling and get results
   */
  stop(): ProfileResult {
    this.logger.off("query", this.queryHandler);

    const duration = Date.now() - this.startTime;
    const totalQueryDuration = this.entries.reduce(
      (sum, e) => sum + e.duration,
      0
    );

    return {
      label: this.label,
      duration,
      queryCount: this.entries.length,
      totalQueryDuration,
      averageQueryDuration:
        this.entries.length > 0 ? totalQueryDuration / this.entries.length : 0,
      queries: this.entries,
      slowQueries: this.entries.filter((e) => e.duration >= 1000).length,
      errors: this.entries.filter((e) => e.error).length,
    };
  }
}

/**
 * Profile result interface
 */
export interface ProfileResult {
  label: string;
  duration: number;
  queryCount: number;
  totalQueryDuration: number;
  averageQueryDuration: number;
  queries: QueryLogEntry[];
  slowQueries: number;
  errors: number;
}

/**
 * Query explain analyzer
 */
export class QueryExplainer {
  private adapter: any;

  constructor(adapter: any) {
    this.adapter = adapter;
  }

  /**
   * Get query execution plan (PostgreSQL/MySQL)
   */
  async explain(query: string, bindings?: any[]): Promise<any> {
    const explainQuery = `EXPLAIN ${query}`;
    return await this.adapter.raw(explainQuery, bindings);
  }

  /**
   * Get detailed query execution plan with analyze (PostgreSQL)
   */
  async explainAnalyze(query: string, bindings?: any[]): Promise<any> {
    const explainQuery = `EXPLAIN ANALYZE ${query}`;
    return await this.adapter.raw(explainQuery, bindings);
  }

  /**
   * Get verbose execution plan (PostgreSQL)
   */
  async explainVerbose(query: string, bindings?: any[]): Promise<any> {
    const explainQuery = `EXPLAIN (VERBOSE, COSTS, TIMING, BUFFERS) ${query}`;
    return await this.adapter.raw(explainQuery, bindings);
  }

  /**
   * Get execution plan in JSON format (PostgreSQL)
   */
  async explainJSON(query: string, bindings?: any[]): Promise<any> {
    const explainQuery = `EXPLAIN (FORMAT JSON) ${query}`;
    return await this.adapter.raw(explainQuery, bindings);
  }

  /**
   * Analyze query and provide suggestions
   */
  async analyzeQuery(query: string, bindings?: any[]): Promise<QueryAnalysis> {
    const plan = await this.explainJSON(query, bindings);
    const analysis: QueryAnalysis = {
      query,
      issues: [],
      suggestions: [],
      estimatedCost: 0,
      estimatedRows: 0,
    };

    // Parse plan and extract information
    if (plan && plan[0] && plan[0].Plan) {
      const planData = plan[0].Plan;
      analysis.estimatedCost = planData["Total Cost"] || 0;
      analysis.estimatedRows = planData["Plan Rows"] || 0;

      // Check for sequential scans
      if (this.hasSequentialScan(planData)) {
        analysis.issues.push("Query uses sequential scan");
        analysis.suggestions.push(
          "Consider adding an index on the filtered columns"
        );
      }

      // Check for sort operations
      if (this.hasSort(planData)) {
        analysis.issues.push("Query requires sorting");
        analysis.suggestions.push(
          "Consider adding an index for the ORDER BY columns"
        );
      }

      // Check for nested loops with high row count
      if (this.hasExpensiveNestedLoop(planData)) {
        analysis.issues.push("Query has expensive nested loop");
        analysis.suggestions.push(
          "Consider optimizing JOIN conditions or adding indexes"
        );
      }
    }

    return analysis;
  }

  private hasSequentialScan(plan: any): boolean {
    if (plan["Node Type"] === "Seq Scan") return true;
    if (plan.Plans) {
      return plan.Plans.some((p: any) => this.hasSequentialScan(p));
    }
    return false;
  }

  private hasSort(plan: any): boolean {
    if (plan["Node Type"] === "Sort") return true;
    if (plan.Plans) {
      return plan.Plans.some((p: any) => this.hasSort(p));
    }
    return false;
  }

  private hasExpensiveNestedLoop(plan: any): boolean {
    if (
      plan["Node Type"] === "Nested Loop" &&
      (plan["Plan Rows"] || 0) > 1000
    ) {
      return true;
    }
    if (plan.Plans) {
      return plan.Plans.some((p: any) => this.hasExpensiveNestedLoop(p));
    }
    return false;
  }
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  query: string;
  issues: string[];
  suggestions: string[];
  estimatedCost: number;
  estimatedRows: number;
}

// Export singleton getter
export const Logger = () => QueryLogger.getInstance();
