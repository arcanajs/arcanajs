import { ModuleLoader } from "../../../utils/ModuleLoader";
import { DatabaseAdapter } from "../types";
import { Schema } from "./Schema";

/**
 * Migration execution mode
 */
export type MigrationMode = "default" | "pretend" | "seed" | "step";

/**
 * Migration direction
 */
export type MigrationDirection = "up" | "down";

/**
 * Migration event types
 */
export type MigrationEventType =
  | "migrating"
  | "migrated"
  | "rolling_back"
  | "rolled_back"
  | "batch_started"
  | "batch_completed"
  | "error";

/**
 * Migration event payload
 */
export interface MigrationEvent {
  type: MigrationEventType;
  migration?: string;
  batch?: number;
  direction?: MigrationDirection;
  duration?: number;
  error?: Error;
  sql?: string[];
  timestamp: Date;
}

/**
 * Migration event listener
 */
export type MigrationEventListener = (
  event: MigrationEvent
) => void | Promise<void>;

/**
 * Migration status
 */
export interface MigrationStatus {
  name: string;
  batch: number;
  ranAt: Date;
  state: "ran" | "pending" | "failed";
}

/**
 * Migration record in database
 */
export interface MigrationRecord {
  id?: number;
  migration: string;
  batch: number;
  created_at?: Date;
  execution_time_ms?: number;
  checksum?: string;
}

/**
 * Migration run options
 */
export interface MigrationRunOptions {
  /**
   * Run in pretend mode (show SQL without executing)
   */
  pretend?: boolean;

  /**
   * Run migrations one step at a time
   */
  step?: boolean;

  /**
   * Run seeders after migrations
   */
  seed?: boolean;

  /**
   * Force run in production
   */
  force?: boolean;

  /**
   * Specific migrations to run
   */
  migrations?: string[];

  /**
   * Database connection to use
   */
  connection?: string;

  /**
   * Run in a transaction
   */
  transaction?: boolean;

  /**
   * Maximum execution time per migration (ms)
   */
  timeout?: number;

  /**
   * Show verbose output
   */
  verbose?: boolean;
}

/**
 * Migration rollback options
 */
export interface MigrationRollbackOptions extends MigrationRunOptions {
  /**
   * Number of batches to rollback
   */
  steps?: number;

  /**
   * Rollback specific migration
   */
  target?: string;

  /**
   * Rollback to specific batch number
   */
  batch?: number;
}

/**
 * Migration squash options
 */
export interface MigrationSquashOptions {
  /**
   * Output file name
   */
  output?: string;

  /**
   * Include data migrations
   */
  includeData?: boolean;

  /**
   * Squash up to this migration
   */
  upTo?: string;
}

/**
 * Migration diff result
 */
export interface MigrationDiff {
  tablesToCreate: string[];
  tablesToDrop: string[];
  columnsToAdd: Array<{ table: string; column: string; type: string }>;
  columnsToModify: Array<{
    table: string;
    column: string;
    from: string;
    to: string;
  }>;
  columnsToRemove: Array<{ table: string; column: string }>;
  indexesToAdd: Array<{ table: string; name: string }>;
  indexesToRemove: Array<{ table: string; name: string }>;
  foreignKeysToAdd: Array<{ table: string; name: string }>;
  foreignKeysToRemove: Array<{ table: string; name: string }>;
}

/**
 * Seeder class interface
 */
export interface Seeder {
  run(): Promise<void>;
  seeders?: string[];
}

/**
 * Base Migration class
 * All migrations should extend this class and implement up() and down() methods
 */
export abstract class Migration {
  /**
   * The database connection name to use
   */
  protected connection?: string;

  /**
   * Whether migration should be run in a transaction
   */
  protected withinTransaction: boolean = true;

  /**
   * Migration description/comment
   */
  protected description?: string;

  /**
   * Dependencies - migrations that must run before this one
   */
  protected dependencies: string[] = [];

  /**
   * SQL statements executed during pretend mode
   */
  protected pretendStatements: string[] = [];

  /**
   * Run the migration
   */
  abstract up(): Promise<void>;

  /**
   * Reverse the migration
   */
  abstract down(): Promise<void>;

  /**
   * Get the connection name
   */
  getConnection(): string | undefined {
    return this.connection;
  }

  /**
   * Check if migration should run in transaction
   */
  shouldRunInTransaction(): boolean {
    return this.withinTransaction;
  }

  /**
   * Get migration description
   */
  getDescription(): string | undefined {
    return this.description;
  }

  /**
   * Get migration dependencies
   */
  getDependencies(): string[] {
    return this.dependencies;
  }

  /**
   * Record SQL statement for pretend mode
   */
  protected recordStatement(sql: string): void {
    this.pretendStatements.push(sql);
  }

  /**
   * Get recorded statements
   */
  getStatements(): string[] {
    return this.pretendStatements;
  }

  /**
   * Clear recorded statements
   */
  clearStatements(): void {
    this.pretendStatements = [];
  }
}

/**
 * Anonymous Migration - for quick inline migrations
 */
export class AnonymousMigration extends Migration {
  private upCallback: () => Promise<void>;
  private downCallback: () => Promise<void>;

  constructor(
    upCallback: () => Promise<void>,
    downCallback: () => Promise<void>
  ) {
    super();
    this.upCallback = upCallback;
    this.downCallback = downCallback;
  }

  async up(): Promise<void> {
    await this.upCallback();
  }

  async down(): Promise<void> {
    await this.downCallback();
  }
}

/**
 * Migration State Machine
 * Tracks migration execution state
 */
export class MigrationStateMachine {
  private state: "idle" | "running" | "error" | "completed" = "idle";
  private currentMigration?: string;
  private startTime?: number;
  private results: Map<
    string,
    { success: boolean; duration: number; error?: Error }
  > = new Map();

  start(migration: string): void {
    this.state = "running";
    this.currentMigration = migration;
    this.startTime = Date.now();
  }

  complete(success: boolean, error?: Error): void {
    const duration = this.startTime ? Date.now() - this.startTime : 0;

    if (this.currentMigration) {
      this.results.set(this.currentMigration, { success, duration, error });
    }

    this.state = success ? "completed" : "error";
    this.currentMigration = undefined;
    this.startTime = undefined;
  }

  getState(): string {
    return this.state;
  }

  getCurrentMigration(): string | undefined {
    return this.currentMigration;
  }

  getResults(): Map<
    string,
    { success: boolean; duration: number; error?: Error }
  > {
    return this.results;
  }

  getElapsedTime(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  reset(): void {
    this.state = "idle";
    this.currentMigration = undefined;
    this.startTime = undefined;
    this.results.clear();
  }
}

/**
 * Migration Repository
 * Handles migration record persistence
 */
export class MigrationRepository {
  private adapter: DatabaseAdapter;
  private table: string;

  constructor(adapter: DatabaseAdapter, table: string = "migrations") {
    this.adapter = adapter;
    this.table = table;
  }

  /**
   * Create the migrations table if needed
   */
  async createRepository(): Promise<void> {
    const exists = await Schema.hasTable(this.table);
    if (!exists) {
      await Schema.create(this.table, (table) => {
        table.id();
        table.string("migration", 255);
        table.integer("batch");
        table.integer("execution_time_ms").nullable();
        table.string("checksum", 64).nullable();
        table.timestamp("created_at").nullable();
        table.index(["batch"]);
        table.index(["migration"]);
      });
    }
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(): Promise<boolean> {
    return Schema.hasTable(this.table);
  }

  /**
   * Get all ran migrations
   */
  async getRan(): Promise<string[]> {
    const records = await this.adapter.select(this.table, {
      orderBy: [
        { column: "batch", direction: "ASC" },
        { column: "migration", direction: "ASC" },
      ],
    });
    return records.map((r: MigrationRecord) => r.migration);
  }

  /**
   * Get migrations by batch
   */
  async getMigrationsByBatch(batch: number): Promise<MigrationRecord[]> {
    return this.adapter.select(this.table, {
      where: [{ column: "batch", operator: "=", value: batch }],
      orderBy: [{ column: "migration", direction: "ASC" }],
    });
  }

  /**
   * Get last batch number
   */
  async getLastBatchNumber(): Promise<number> {
    const records = await this.adapter.select(this.table, {
      orderBy: [{ column: "batch", direction: "DESC" }],
      limit: 1,
    });
    return records.length > 0 ? records[0].batch : 0;
  }

  /**
   * Get next batch number
   */
  async getNextBatchNumber(): Promise<number> {
    return (await this.getLastBatchNumber()) + 1;
  }

  /**
   * Log a migration run
   */
  async log(
    migration: string,
    batch: number,
    executionTime?: number,
    checksum?: string
  ): Promise<void> {
    await this.adapter.insert(this.table, {
      migration,
      batch,
      execution_time_ms: executionTime,
      checksum,
      created_at: new Date(),
    });
  }

  /**
   * Remove a migration record
   */
  async delete(migration: string): Promise<void> {
    // Find and delete by migration name
    const records = await this.adapter.select(this.table, {
      where: [{ column: "migration", operator: "=", value: migration }],
    });

    for (const record of records) {
      await this.adapter.delete(this.table, record.id);
    }
  }

  /**
   * Get last migrations
   */
  async getLast(): Promise<MigrationRecord[]> {
    const lastBatch = await this.getLastBatchNumber();
    if (lastBatch === 0) return [];

    return this.adapter.select(this.table, {
      where: [{ column: "batch", operator: "=", value: lastBatch }],
      orderBy: [{ column: "migration", direction: "DESC" }],
    });
  }

  /**
   * Get all migration records
   */
  async getMigrations(): Promise<MigrationRecord[]> {
    return this.adapter.select(this.table, {
      orderBy: [
        { column: "batch", direction: "ASC" },
        { column: "migration", direction: "ASC" },
      ],
    });
  }

  /**
   * Delete all migration records
   */
  async deleteAll(): Promise<void> {
    const records = await this.getMigrations();
    for (const record of records) {
      await this.adapter.delete(this.table, record.id);
    }
  }
}

/**
 * Migration File Resolver
 * Handles finding and loading migration files
 */
export class MigrationFileResolver {
  private paths: string[];
  private extensions: string[] = [".ts", ".js"];

  constructor(paths: string | string[]) {
    this.paths = Array.isArray(paths) ? paths : [paths];
  }

  /**
   * Get all migration files sorted by name
   */
  async getMigrationFiles(): Promise<Map<string, string>> {
    const fs = await import("fs");
    const pathModule = await import("path");
    const files = new Map<string, string>();

    for (const dir of this.paths) {
      if (!fs.existsSync(dir)) continue;

      const dirFiles = fs.readdirSync(dir);

      for (const file of dirFiles) {
        if (!this.isMigrationFile(file)) continue;

        const name = this.getMigrationName(file);
        const fullPath = pathModule.resolve(dir, file);

        if (!files.has(name)) {
          files.set(name, fullPath);
        }
      }
    }

    // Sort by migration name (which typically includes timestamp)
    return new Map(
      [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    );
  }

  /**
   * Check if file is a migration file
   */
  private isMigrationFile(file: string): boolean {
    return this.extensions.some((ext) => file.endsWith(ext));
  }

  /**
   * Get migration name from filename
   */
  getMigrationName(file: string): string {
    return file.replace(/\.(ts|js)$/, "");
  }

  /**
   * Load a migration class from file
   */
  async loadMigration(filePath: string): Promise<new () => Migration> {
    const migrationModule = ModuleLoader.require(filePath);
    const MigrationClass = migrationModule.default || migrationModule;

    if (!MigrationClass || typeof MigrationClass !== "function") {
      throw new Error(
        `Migration file ${filePath} does not export a valid migration class`
      );
    }

    // Validate migration
    const instance = new MigrationClass();
    if (
      typeof instance.up !== "function" ||
      typeof instance.down !== "function"
    ) {
      throw new Error(
        `Migration class in ${filePath} must implement up() and down() methods`
      );
    }

    return MigrationClass;
  }

  /**
   * Add migration path
   */
  addPath(path: string): void {
    if (!this.paths.includes(path)) {
      this.paths.push(path);
    }
  }

  /**
   * Get all paths
   */
  getPaths(): string[] {
    return [...this.paths];
  }
}

/**
 * Migration Checksum Calculator
 * Calculates checksums for migration files to detect changes
 */
export class MigrationChecksumCalculator {
  /**
   * Calculate checksum for a file
   */
  async calculateChecksum(filePath: string): Promise<string> {
    const fs = await import("fs");
    const crypto = await import("crypto");

    const content = fs.readFileSync(filePath, "utf-8");
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 64);
  }

  /**
   * Verify checksum matches
   */
  async verifyChecksum(
    filePath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(filePath);
    return actualChecksum === expectedChecksum;
  }
}

/**
 * Migration Output Formatter
 * Formats migration output for display
 */
export class MigrationOutputFormatter {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  migrating(name: string): string {
    return `\x1b[33mMigrating:\x1b[0m ${name}`;
  }

  migrated(name: string, duration: number): string {
    return `\x1b[32mMigrated:\x1b[0m  ${name} (${duration}ms)`;
  }

  rollingBack(name: string): string {
    return `\x1b[33mRolling back:\x1b[0m ${name}`;
  }

  rolledBack(name: string, duration: number): string {
    return `\x1b[32mRolled back:\x1b[0m  ${name} (${duration}ms)`;
  }

  error(name: string, error: Error): string {
    return `\x1b[31mFailed:\x1b[0m     ${name}\n${error.message}`;
  }

  noPending(): string {
    return "\x1b[34mNothing to migrate.\x1b[0m";
  }

  noRollback(): string {
    return "\x1b[34mNothing to rollback.\x1b[0m";
  }

  batchInfo(batch: number, count: number): string {
    return `\x1b[36mBatch ${batch}:\x1b[0m ${count} migration(s)`;
  }

  totalTime(duration: number): string {
    return `\n\x1b[32mTotal time:\x1b[0m ${duration}ms`;
  }

  pretendSQL(statements: string[]): string {
    return statements.map((s) => `\x1b[90m${s}\x1b[0m`).join("\n");
  }

  statusTable(statuses: MigrationStatus[]): string {
    const header =
      "+" +
      "-".repeat(50) +
      "+" +
      "-".repeat(10) +
      "+" +
      "-".repeat(12) +
      "+" +
      "-".repeat(25) +
      "+";
    const columns =
      "| " +
      "Migration".padEnd(48) +
      " | " +
      "Batch".padEnd(8) +
      " | " +
      "Status".padEnd(10) +
      " | " +
      "Ran At".padEnd(23) +
      " |";

    let output = header + "\n" + columns + "\n" + header + "\n";

    for (const status of statuses) {
      const statusColor =
        status.state === "ran"
          ? "\x1b[32m"
          : status.state === "pending"
          ? "\x1b[33m"
          : "\x1b[31m";
      const name = status.name.substring(0, 48).padEnd(48);
      const batch = String(status.batch).padEnd(8);
      const state = statusColor + status.state.padEnd(10) + "\x1b[0m";
      const ranAt = (status.ranAt ? status.ranAt.toISOString() : "N/A")
        .substring(0, 23)
        .padEnd(23);

      output += `| ${name} | ${batch} | ${state} | ${ranAt} |\n`;
    }

    output += header;
    return output;
  }
}

/**
 * Migration Runner - Professional migration execution engine
 */
export class MigrationRunner {
  private adapter: DatabaseAdapter;
  private repository: MigrationRepository;
  private resolver: MigrationFileResolver;
  private checksumCalculator: MigrationChecksumCalculator;
  private formatter: MigrationOutputFormatter;
  private stateMachine: MigrationStateMachine;
  private eventListeners: Map<MigrationEventType, MigrationEventListener[]> =
    new Map();
  private seedersPath?: string;

  constructor(adapter: DatabaseAdapter, migrationsPath: string | string[]) {
    this.adapter = adapter;
    this.repository = new MigrationRepository(adapter);
    this.resolver = new MigrationFileResolver(migrationsPath);
    this.checksumCalculator = new MigrationChecksumCalculator();
    this.formatter = new MigrationOutputFormatter();
    this.stateMachine = new MigrationStateMachine();
  }

  /**
   * Set seeders path
   */
  setSeedersPath(path: string): this {
    this.seedersPath = path;
    return this;
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): this {
    this.formatter = new MigrationOutputFormatter(verbose);
    return this;
  }

  /**
   * Add event listener
   */
  on(event: MigrationEventType, listener: MigrationEventListener): this {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
    return this;
  }

  /**
   * Remove event listener
   */
  off(event: MigrationEventType, listener: MigrationEventListener): this {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    return this;
  }

  /**
   * Emit event
   */
  private async emit(event: MigrationEvent): Promise<void> {
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      await listener(event);
    }
  }

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    await this.repository.createRepository();
  }

  /**
   * Get all ran migrations
   */
  private async getRanMigrations(): Promise<MigrationRecord[]> {
    await this.ensureMigrationsTable();
    return this.repository.getMigrations();
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<string[]> {
    await this.ensureMigrationsTable();

    const ranMigrations = await this.repository.getRan();
    const allMigrations = await this.resolver.getMigrationFiles();

    const pending: string[] = [];

    for (const [name] of allMigrations) {
      if (!ranMigrations.includes(name)) {
        pending.push(name);
      }
    }

    return pending;
  }

  /**
   * Run pending migrations
   */
  async run(options: MigrationRunOptions = {}): Promise<void> {
    await this.ensureMigrationsTable();

    const allMigrations = await this.resolver.getMigrationFiles();
    let pendingMigrations = await this.getPendingMigrations();

    // Filter by specific migrations if provided
    if (options.migrations && options.migrations.length > 0) {
      pendingMigrations = pendingMigrations.filter((m) =>
        options.migrations!.includes(m)
      );
    }

    if (pendingMigrations.length === 0) {
      console.log(this.formatter.noPending());
      return;
    }

    const nextBatch = await this.repository.getNextBatchNumber();
    const totalStartTime = Date.now();

    await this.emit({
      type: "batch_started",
      batch: nextBatch,
      timestamp: new Date(),
    });

    console.log(this.formatter.batchInfo(nextBatch, pendingMigrations.length));

    // Run step by step if requested
    const migrationsToRun = options.step
      ? [pendingMigrations[0]]
      : pendingMigrations;

    for (const migrationName of migrationsToRun) {
      const migrationPath = allMigrations.get(migrationName);
      if (!migrationPath) continue;

      this.stateMachine.start(migrationName);
      const startTime = Date.now();

      try {
        await this.emit({
          type: "migrating",
          migration: migrationName,
          direction: "up",
          timestamp: new Date(),
        });

        console.log(this.formatter.migrating(migrationName));

        const MigrationClass = await this.resolver.loadMigration(migrationPath);
        const migration = new MigrationClass() as Migration;

        // Run in transaction if supported and requested
        const useTransaction =
          options.transaction !== false && migration.shouldRunInTransaction();

        if (
          useTransaction &&
          typeof (this.adapter as any).beginTransaction === "function"
        ) {
          await (this.adapter as any).beginTransaction();
        }

        try {
          if (options.pretend) {
            // Pretend mode - collect SQL statements
            console.log("Would run migration: " + migrationName);
          } else {
            // Execute with timeout if specified
            if (options.timeout) {
              await Promise.race([
                migration.up(),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Migration timeout")),
                    options.timeout
                  )
                ),
              ]);
            } else {
              await migration.up();
            }
          }

          if (
            useTransaction &&
            typeof (this.adapter as any).commit === "function"
          ) {
            await (this.adapter as any).commit();
          }
        } catch (error) {
          if (
            useTransaction &&
            typeof (this.adapter as any).rollback === "function"
          ) {
            await (this.adapter as any).rollback();
          }
          throw error;
        }

        const duration = Date.now() - startTime;

        // Calculate checksum
        const checksum = await this.checksumCalculator.calculateChecksum(
          migrationPath
        );

        // Record migration (skip in pretend mode)
        if (!options.pretend) {
          await this.repository.log(
            migrationName,
            nextBatch,
            duration,
            checksum
          );
        }

        this.stateMachine.complete(true);
        console.log(this.formatter.migrated(migrationName, duration));

        await this.emit({
          type: "migrated",
          migration: migrationName,
          direction: "up",
          duration,
          timestamp: new Date(),
        });
      } catch (error) {
        this.stateMachine.complete(false, error as Error);
        console.error(this.formatter.error(migrationName, error as Error));

        await this.emit({
          type: "error",
          migration: migrationName,
          error: error as Error,
          timestamp: new Date(),
        });

        throw error;
      }
    }

    const totalDuration = Date.now() - totalStartTime;
    console.log(this.formatter.totalTime(totalDuration));

    await this.emit({
      type: "batch_completed",
      batch: nextBatch,
      timestamp: new Date(),
    });

    // Run seeders if requested
    if (options.seed && this.seedersPath) {
      await this.seed();
    }
  }

  /**
   * Rollback last batch of migrations
   */
  async rollback(options: MigrationRollbackOptions = {}): Promise<void> {
    await this.ensureMigrationsTable();

    const steps = options.steps || 1;
    let migrationsToRollback: MigrationRecord[];

    if (options.target) {
      // Rollback specific migration
      const records = await this.repository.getMigrations();
      migrationsToRollback = records.filter(
        (m) => m.migration === options.target
      );
    } else if (options.batch !== undefined) {
      // Rollback to specific batch
      const records = await this.repository.getMigrations();
      migrationsToRollback = records.filter((m) => m.batch >= options.batch!);
    } else {
      // Rollback last N batches
      const lastBatch = await this.repository.getLastBatchNumber();
      if (lastBatch === 0) {
        console.log(this.formatter.noRollback());
        return;
      }

      const minBatch = Math.max(1, lastBatch - steps + 1);
      const records = await this.repository.getMigrations();
      migrationsToRollback = records.filter(
        (m) => m.batch >= minBatch && m.batch <= lastBatch
      );
    }

    if (migrationsToRollback.length === 0) {
      console.log(this.formatter.noRollback());
      return;
    }

    // Sort descending for rollback order
    migrationsToRollback.sort((a, b) => b.migration.localeCompare(a.migration));

    const allMigrations = await this.resolver.getMigrationFiles();
    const totalStartTime = Date.now();

    console.log(`Rolling back ${migrationsToRollback.length} migration(s)...`);

    for (const record of migrationsToRollback) {
      const migrationPath = allMigrations.get(record.migration);

      if (!migrationPath) {
        console.warn(`Migration file not found: ${record.migration}`);
        continue;
      }

      this.stateMachine.start(record.migration);
      const startTime = Date.now();

      try {
        await this.emit({
          type: "rolling_back",
          migration: record.migration,
          direction: "down",
          timestamp: new Date(),
        });

        console.log(this.formatter.rollingBack(record.migration));

        const MigrationClass = await this.resolver.loadMigration(migrationPath);
        const migration = new MigrationClass() as Migration;

        const useTransaction =
          options.transaction !== false && migration.shouldRunInTransaction();

        if (
          useTransaction &&
          typeof (this.adapter as any).beginTransaction === "function"
        ) {
          await (this.adapter as any).beginTransaction();
        }

        try {
          if (options.pretend) {
            console.log("Would rollback migration: " + record.migration);
          } else {
            await migration.down();
          }

          if (
            useTransaction &&
            typeof (this.adapter as any).commit === "function"
          ) {
            await (this.adapter as any).commit();
          }
        } catch (error) {
          if (
            useTransaction &&
            typeof (this.adapter as any).rollback === "function"
          ) {
            await (this.adapter as any).rollback();
          }
          throw error;
        }

        const duration = Date.now() - startTime;

        // Remove migration record (skip in pretend mode)
        if (!options.pretend) {
          await this.repository.delete(record.migration);
        }

        this.stateMachine.complete(true);
        console.log(this.formatter.rolledBack(record.migration, duration));

        await this.emit({
          type: "rolled_back",
          migration: record.migration,
          direction: "down",
          duration,
          timestamp: new Date(),
        });
      } catch (error) {
        this.stateMachine.complete(false, error as Error);
        console.error(this.formatter.error(record.migration, error as Error));

        await this.emit({
          type: "error",
          migration: record.migration,
          error: error as Error,
          timestamp: new Date(),
        });

        throw error;
      }
    }

    const totalDuration = Date.now() - totalStartTime;
    console.log(this.formatter.totalTime(totalDuration));
  }

  /**
   * Reset all migrations
   */
  async reset(options: MigrationRollbackOptions = {}): Promise<void> {
    const lastBatch = await this.repository.getLastBatchNumber();
    if (lastBatch === 0) {
      console.log(this.formatter.noRollback());
      return;
    }

    await this.rollback({ ...options, steps: lastBatch });
  }

  /**
   * Reset and re-run all migrations
   */
  async fresh(options: MigrationRunOptions = {}): Promise<void> {
    // Drop all tables
    await Schema.dropAllTables();

    // Run all migrations
    await this.run(options);
  }

  /**
   * Refresh migrations (rollback all then run)
   */
  async refresh(options: MigrationRunOptions = {}): Promise<void> {
    await this.reset();
    await this.run(options);
  }

  /**
   * Get migration status
   */
  async status(): Promise<MigrationStatus[]> {
    await this.ensureMigrationsTable();

    const ranMigrations = await this.repository.getMigrations();
    const allMigrations = await this.resolver.getMigrationFiles();

    const statuses: MigrationStatus[] = [];

    // Add ran migrations
    const ranSet = new Set<string>();
    for (const record of ranMigrations) {
      ranSet.add(record.migration);
      statuses.push({
        name: record.migration,
        batch: record.batch,
        ranAt: record.created_at || new Date(),
        state: "ran",
      });
    }

    // Add pending migrations
    for (const [name] of allMigrations) {
      if (!ranSet.has(name)) {
        statuses.push({
          name,
          batch: 0,
          ranAt: new Date(),
          state: "pending",
        });
      }
    }

    // Sort by name
    statuses.sort((a, b) => a.name.localeCompare(b.name));

    return statuses;
  }

  /**
   * Display formatted status
   */
  async showStatus(): Promise<void> {
    const statuses = await this.status();
    console.log(this.formatter.statusTable(statuses));
  }

  /**
   * Run database seeders
   */
  async seed(seederClass?: string): Promise<void> {
    if (!this.seedersPath) {
      throw new Error("Seeders path not configured");
    }

    const fs = await import("fs");
    const path = await import("path");

    if (seederClass) {
      // Run specific seeder
      const seederPath = path.resolve(this.seedersPath, seederClass + ".ts");
      if (!fs.existsSync(seederPath)) {
        throw new Error(`Seeder not found: ${seederClass}`);
      }

      const SeederModule = ModuleLoader.require(seederPath);
      const Seeder = SeederModule.default || SeederModule;
      const seeder = new Seeder() as Seeder;

      console.log(`Seeding: ${seederClass}`);
      await seeder.run();
      console.log(`Seeded: ${seederClass}`);
    } else {
      // Run DatabaseSeeder
      const mainSeederPath = path.resolve(
        this.seedersPath,
        "DatabaseSeeder.ts"
      );

      if (!fs.existsSync(mainSeederPath)) {
        throw new Error("DatabaseSeeder not found");
      }

      const SeederModule = ModuleLoader.require(mainSeederPath);
      const DatabaseSeeder = SeederModule.default || SeederModule;
      const seeder = new DatabaseSeeder() as Seeder;

      console.log("Running seeders...");
      await seeder.run();
      console.log("Seeding completed");
    }
  }

  /**
   * Squash migrations into a single file
   */
  async squash(options: MigrationSquashOptions = {}): Promise<string> {
    const statuses = await this.status();
    const ranMigrations = statuses.filter((s) => s.state === "ran");

    if (ranMigrations.length === 0) {
      throw new Error("No migrations to squash");
    }

    // Generate schema dump
    const tables = await Schema.getTables();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .substring(0, 14);
    const filename = options.output || `${timestamp}_squashed_migrations`;

    let content = `import { Migration } from 'arcanajs/arcanox';\nimport { Schema } from 'arcanajs/arcanox';\n\n`;
    content += `/**\n * Squashed migration\n * Contains: ${ranMigrations
      .map((m) => m.name)
      .join(", ")}\n */\n`;
    content += `export default class ${this.toPascalCase(
      filename
    )} extends Migration {\n`;
    content += `  async up(): Promise<void> {\n`;
    content += `    // Recreate all tables from schema dump\n`;

    for (const table of tables) {
      if (table === "migrations") continue;
      content += `    // Table: ${table}\n`;
      content += `    await Schema.create('${table}', table => {\n`;
      content += `      // Add columns based on schema inspection\n`;
      content += `    });\n\n`;
    }

    content += `  }\n\n`;
    content += `  async down(): Promise<void> {\n`;

    for (const table of tables.reverse()) {
      if (table === "migrations") continue;
      content += `    await Schema.dropIfExists('${table}');\n`;
    }

    content += `  }\n`;
    content += `}\n`;

    return content;
  }

  /**
   * Generate migration diff from models
   */
  async diff(): Promise<MigrationDiff> {
    // This would compare current database schema with model definitions
    // For now, return empty diff
    return {
      tablesToCreate: [],
      tablesToDrop: [],
      columnsToAdd: [],
      columnsToModify: [],
      columnsToRemove: [],
      indexesToAdd: [],
      indexesToRemove: [],
      foreignKeysToAdd: [],
      foreignKeysToRemove: [],
    };
  }

  /**
   * Verify migration integrity
   */
  async verify(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const records = await this.repository.getMigrations();
    const allMigrations = await this.resolver.getMigrationFiles();

    for (const record of records) {
      const migrationPath = allMigrations.get(record.migration);

      if (!migrationPath) {
        issues.push(`Missing migration file: ${record.migration}`);
        continue;
      }

      if (record.checksum) {
        const isValid = await this.checksumCalculator.verifyChecksum(
          migrationPath,
          record.checksum
        );
        if (!isValid) {
          issues.push(`Checksum mismatch for migration: ${record.migration}`);
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Get state machine for monitoring
   */
  getStateMachine(): MigrationStateMachine {
    return this.stateMachine;
  }

  /**
   * Get repository for direct access
   */
  getRepository(): MigrationRepository {
    return this.repository;
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toUpperCase());
  }
}

/**
 * Migration Creator - Generates migration files
 */
export class MigrationCreator {
  private stubsPath?: string;
  private outputPath: string;

  constructor(outputPath: string, stubsPath?: string) {
    this.outputPath = outputPath;
    this.stubsPath = stubsPath;
  }

  /**
   * Create a new migration file
   */
  async create(
    name: string,
    options: {
      table?: string;
      create?: boolean;
      update?: boolean;
      stub?: string;
    } = {}
  ): Promise<string> {
    const fs = await import("fs");
    const path = await import("path");

    const timestamp = this.generateTimestamp();
    const filename = `${timestamp}_${this.toSnakeCase(name)}.ts`;
    const className = this.toPascalCase(name);

    let stub: string;

    if (options.stub && this.stubsPath) {
      const stubPath = path.resolve(this.stubsPath, options.stub + ".stub");
      if (fs.existsSync(stubPath)) {
        stub = fs.readFileSync(stubPath, "utf-8");
      } else {
        stub = this.getDefaultStub(options);
      }
    } else {
      stub = this.getDefaultStub(options);
    }

    // Replace placeholders
    const content = stub
      .replace(/\{\{className\}\}/g, className)
      .replace(/\{\{table\}\}/g, options.table || "table_name");

    const filePath = path.resolve(this.outputPath, filename);

    // Ensure directory exists
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content);

    return filePath;
  }

  /**
   * Get default stub content
   */
  private getDefaultStub(options: {
    table?: string;
    create?: boolean;
    update?: boolean;
  }): string {
    if (options.create && options.table) {
      return `import { Migration, Schema, Blueprint } from 'arcanajs/arcanox';

export default class {{className}} extends Migration {
  async up(): Promise<void> {
    await Schema.create('{{table}}', (table: Blueprint) => {
      table.id();
      // Add your columns here
      table.timestamps();
    });
  }

  async down(): Promise<void> {
    await Schema.dropIfExists('{{table}}');
  }
}
`;
    }

    if (options.update && options.table) {
      return `import { Migration, Schema, Blueprint } from 'arcanajs/arcanox';

export default class {{className}} extends Migration {
  async up(): Promise<void> {
    await Schema.table('{{table}}', (table: Blueprint) => {
      // Add your column modifications here
    });
  }

  async down(): Promise<void> {
    await Schema.table('{{table}}', (table: Blueprint) => {
      // Reverse the modifications
    });
  }
}
`;
    }

    return `import { Migration, Schema, Blueprint } from 'arcanajs/arcanox';

export default class {{className}} extends Migration {
  async up(): Promise<void> {
    // Write your migration code here
  }

  async down(): Promise<void> {
    // Reverse the migration
  }
}
`;
  }

  /**
   * Generate timestamp for migration filename
   */
  private generateTimestamp(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[\s-]+/g, "_")
      .toLowerCase();
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
      .replace(/[\s]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toUpperCase());
  }
}

/**
 * Seeder Base Class
 */
export abstract class BaseSeeder implements Seeder {
  /**
   * List of seeders to call
   */
  seeders: string[] = [];

  /**
   * Run the seeder
   */
  abstract run(): Promise<void>;

  /**
   * Call another seeder
   */
  protected async call(seederClass: string): Promise<void> {
    const path = await import("path");
    const seederPath = path.resolve(
      process.cwd(),
      "database/seeders",
      seederClass + ".ts"
    );

    const SeederModule = ModuleLoader.require(seederPath);
    const Seeder = SeederModule.default || SeederModule;
    const seeder = new Seeder() as BaseSeeder;

    console.log(`  Seeding: ${seederClass}`);
    await seeder.run();
  }

  /**
   * Call all registered seeders
   */
  protected async callSeeders(): Promise<void> {
    for (const seeder of this.seeders) {
      await this.call(seeder);
    }
  }
}
