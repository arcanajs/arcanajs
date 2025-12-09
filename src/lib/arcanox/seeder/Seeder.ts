import { ModuleLoader } from "../../../utils/ModuleLoader";

/**
 * Seeder execution mode
 */
export type SeederMode = "default" | "truncate" | "refresh";

/**
 * Seeder execution options
 */
export interface SeederOptions {
  /**
   * Run in truncate mode - clear table before seeding
   */
  truncate?: boolean;

  /**
   * Run in refresh mode - delete all then seed
   */
  refresh?: boolean;

  /**
   * Show verbose output
   */
  verbose?: boolean;

  /**
   * Run in transaction
   */
  transaction?: boolean;

  /**
   * Environment restrictions
   */
  environments?: string[];

  /**
   * Database connection to use
   */
  connection?: string;
}

/**
 * Seeder event types
 */
export type SeederEventType =
  | "seeding"
  | "seeded"
  | "calling"
  | "called"
  | "error"
  | "truncating"
  | "truncated";

/**
 * Seeder event payload
 */
export interface SeederEvent {
  type: SeederEventType;
  seeder: string;
  duration?: number;
  count?: number;
  error?: Error;
  timestamp: Date;
}

/**
 * Seeder event listener
 */
export type SeederEventListener = (event: SeederEvent) => void | Promise<void>;

/**
 * Seeder statistics
 */
export interface SeederStats {
  seedersRun: number;
  recordsCreated: number;
  totalDuration: number;
  errors: number;
  skipped: number;
}

/**
 * Base Seeder class - Professional database seeding
 *
 * @example
 * ```typescript
 * class UserSeeder extends Seeder {
 *   async run() {
 *     await this.factory(UserFactory).count(10).create();
 *   }
 * }
 * ```
 */
export abstract class Seeder {
  /**
   * Seeders to call before this one runs
   */
  protected dependencies: Array<new () => Seeder> = [];

  /**
   * Seeders to call after this one runs
   */
  protected seeders: Array<new () => Seeder> = [];

  /**
   * Whether to run in a transaction
   */
  protected withinTransaction: boolean = false;

  /**
   * Environments where this seeder can run
   */
  protected environments: string[] = [];

  /**
   * Description of what this seeder does
   */
  protected description?: string;

  /**
   * Current seeder options
   */
  protected options: SeederOptions = {};

  /**
   * Seeder statistics
   */
  protected stats: SeederStats = {
    seedersRun: 0,
    recordsCreated: 0,
    totalDuration: 0,
    errors: 0,
    skipped: 0,
  };

  /**
   * Event listeners
   */
  private eventListeners: Map<SeederEventType, SeederEventListener[]> =
    new Map();

  /**
   * Console output formatter
   */
  private formatter = new SeederOutputFormatter();

  /**
   * Run the database seeds.
   */
  abstract run(): Promise<void>;

  /**
   * Set seeder options
   */
  setOptions(options: SeederOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Add event listener
   */
  on(event: SeederEventType, listener: SeederEventListener): this {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
    return this;
  }

  /**
   * Emit event
   */
  protected async emit(event: SeederEvent): Promise<void> {
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      await listener(event);
    }
  }

  /**
   * Execute the seeder with all hooks and options
   */
  async execute(options: SeederOptions = {}): Promise<SeederStats> {
    this.setOptions(options);
    const startTime = Date.now();

    // Check environment restrictions
    if (!this.canRunInEnvironment()) {
      console.log(
        this.formatter.skipped(this.constructor.name, `Environment restriction`)
      );
      this.stats.skipped++;
      return this.stats;
    }

    try {
      // Run dependencies first
      await this.runDependencies();

      await this.emit({
        type: "seeding",
        seeder: this.constructor.name,
        timestamp: new Date(),
      });

      console.log(this.formatter.seeding(this.constructor.name));

      // Run the main seeder
      await this.run();

      const duration = Date.now() - startTime;
      this.stats.seedersRun++;
      this.stats.totalDuration += duration;

      await this.emit({
        type: "seeded",
        seeder: this.constructor.name,
        duration,
        timestamp: new Date(),
      });

      console.log(this.formatter.seeded(this.constructor.name, duration));

      // Run child seeders
      await this.runChildSeeders();
    } catch (error) {
      this.stats.errors++;
      await this.emit({
        type: "error",
        seeder: this.constructor.name,
        error: error as Error,
        timestamp: new Date(),
      });

      console.error(
        this.formatter.error(this.constructor.name, error as Error)
      );
      throw error;
    }

    return this.stats;
  }

  /**
   * Check if seeder can run in current environment
   */
  private canRunInEnvironment(): boolean {
    if (this.environments.length === 0) {
      return true;
    }

    const currentEnv = process.env.NODE_ENV || "development";
    return this.environments.includes(currentEnv);
  }

  /**
   * Run dependency seeders
   */
  private async runDependencies(): Promise<void> {
    for (const SeederClass of this.dependencies) {
      await this.call(SeederClass);
    }
  }

  /**
   * Run child seeders
   */
  private async runChildSeeders(): Promise<void> {
    for (const SeederClass of this.seeders) {
      await this.call(SeederClass);
    }
  }

  /**
   * Call another seeder
   */
  async call(SeederClass: new () => Seeder): Promise<void> {
    await this.emit({
      type: "calling",
      seeder: SeederClass.name,
      timestamp: new Date(),
    });

    console.log(this.formatter.calling(SeederClass.name));

    const seeder = new SeederClass();
    seeder.setOptions(this.options);

    // Copy event listeners
    for (const [event, listeners] of this.eventListeners) {
      for (const listener of listeners) {
        seeder.on(event, listener);
      }
    }

    const childStats = await seeder.execute(this.options);

    // Merge stats
    this.stats.seedersRun += childStats.seedersRun;
    this.stats.recordsCreated += childStats.recordsCreated;
    this.stats.totalDuration += childStats.totalDuration;
    this.stats.errors += childStats.errors;
    this.stats.skipped += childStats.skipped;

    await this.emit({
      type: "called",
      seeder: SeederClass.name,
      timestamp: new Date(),
    });
  }

  /**
   * Call multiple seeders
   */
  async callMany(seeders: Array<new () => Seeder>): Promise<void> {
    for (const SeederClass of seeders) {
      await this.call(SeederClass);
    }
  }

  /**
   * Call seeders conditionally
   */
  async callIf(
    condition: boolean | (() => boolean | Promise<boolean>),
    SeederClass: new () => Seeder
  ): Promise<void> {
    const shouldCall =
      typeof condition === "function" ? await condition() : condition;

    if (shouldCall) {
      await this.call(SeederClass);
    }
  }

  /**
   * Call seeders unless condition is true
   */
  async callUnless(
    condition: boolean | (() => boolean | Promise<boolean>),
    SeederClass: new () => Seeder
  ): Promise<void> {
    const shouldSkip =
      typeof condition === "function" ? await condition() : condition;

    if (!shouldSkip) {
      await this.call(SeederClass);
    }
  }

  /**
   * Get factory builder for a factory class
   */
  factory<T extends import("../Model").Model>(
    FactoryClass: new () => import("../factory/Factory").Factory<T>
  ): FactoryBuilder<T> {
    const factory = new FactoryClass();
    return new FactoryBuilder(factory, this);
  }

  /**
   * Truncate a table before seeding
   */
  async truncate(ModelClass: typeof import("../Model").Model): Promise<void> {
    await this.emit({
      type: "truncating",
      seeder: this.constructor.name,
      timestamp: new Date(),
    });

    const instance = new (ModelClass as any)();
    const tableName = instance.constructor.tableName || instance.table;

    if (global.ArcanaJSDatabaseAdapter) {
      await global.ArcanaJSDatabaseAdapter.raw(
        `TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`
      );
    }

    await this.emit({
      type: "truncated",
      seeder: this.constructor.name,
      timestamp: new Date(),
    });
  }

  /**
   * Delete all records from a table
   */
  async deleteAll(ModelClass: typeof import("../Model").Model): Promise<void> {
    const instance = new (ModelClass as any)();
    const tableName = instance.constructor.tableName || instance.table;

    if (global.ArcanaJSDatabaseAdapter) {
      await global.ArcanaJSDatabaseAdapter.raw(`DELETE FROM ${tableName}`);
    }
  }

  /**
   * Get seeder statistics
   */
  getStats(): SeederStats {
    return { ...this.stats };
  }

  /**
   * Get seeder description
   */
  getDescription(): string | undefined {
    return this.description;
  }

  /**
   * Check if running in production
   */
  protected isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  /**
   * Only run in development
   */
  protected onlyInDevelopment(): boolean {
    return process.env.NODE_ENV === "development";
  }

  /**
   * Console log with prefix
   */
  protected log(message: string): void {
    if (this.options.verbose) {
      console.log(`  ${message}`);
    }
  }

  /**
   * Increment records created count
   */
  incrementRecordsCreated(count: number = 1): void {
    this.stats.recordsCreated += count;
  }
}

/**
 * Factory Builder - Fluent interface for factory usage in seeders
 */
export class FactoryBuilder<T extends import("../Model").Model> {
  private factory: import("../factory/Factory").Factory<T>;
  private seeder: Seeder;
  private _count: number = 1;
  private _state: string | null = null;
  private _attributes: Partial<T> = {};
  private _afterCreating: Array<(model: T) => void | Promise<void>> = [];
  private _sequence: number = 0;

  constructor(
    factory: import("../factory/Factory").Factory<T>,
    seeder: Seeder
  ) {
    this.factory = factory;
    this.seeder = seeder;
  }

  /**
   * Set the number of models to create
   */
  count(count: number): this {
    this._count = count;
    return this;
  }

  /**
   * Apply a state to the factory
   */
  state(state: string): this {
    this._state = state;
    return this;
  }

  /**
   * Override specific attributes
   */
  attributes(attributes: Partial<T>): this {
    this._attributes = { ...this._attributes, ...attributes };
    return this;
  }

  /**
   * Add callback to run after creating
   */
  afterCreating(callback: (model: T) => void | Promise<void>): this {
    this._afterCreating.push(callback);
    return this;
  }

  /**
   * Create models with sequence
   */
  sequence(callback: (sequence: number) => Partial<T>): this {
    const originalAttributes = this._attributes;
    this._attributes = {
      ...originalAttributes,
      ...callback(this._sequence++),
    } as Partial<T>;
    return this;
  }

  /**
   * Create and persist the models
   */
  async create(): Promise<T[]> {
    const models: T[] = [];

    for (let i = 0; i < this._count; i++) {
      // Apply state if defined
      if (
        this._state &&
        typeof (this.factory as any)[this._state] === "function"
      ) {
        (this.factory as any)[this._state]();
      }

      const result = await this.factory.create(this._attributes);
      const model = Array.isArray(result) ? result[0] : result;
      models.push(model);

      // Run after creating callbacks
      for (const callback of this._afterCreating) {
        await callback(model);
      }

      this.seeder.incrementRecordsCreated();
    }

    return models;
  }

  /**
   * Create models without persisting
   */
  make(): T[] {
    const models: T[] = [];

    for (let i = 0; i < this._count; i++) {
      if (
        this._state &&
        typeof (this.factory as any)[this._state] === "function"
      ) {
        (this.factory as any)[this._state]();
      }

      const result = this.factory.make(this._attributes);
      const model = Array.isArray(result) ? result[0] : result;
      models.push(model);
    }

    return models;
  }
}

/**
 * Seeder Output Formatter
 */
class SeederOutputFormatter {
  seeding(name: string): string {
    return `\x1b[33mSeeding:\x1b[0m ${name}`;
  }

  seeded(name: string, duration: number): string {
    return `\x1b[32mSeeded:\x1b[0m  ${name} (${duration}ms)`;
  }

  calling(name: string): string {
    return `  \x1b[36mCalling:\x1b[0m ${name}`;
  }

  skipped(name: string, reason: string): string {
    return `\x1b[90mSkipped:\x1b[0m ${name} - ${reason}`;
  }

  error(name: string, error: Error): string {
    return `\x1b[31mFailed:\x1b[0m  ${name}\n${error.message}`;
  }
}

/**
 * Database Seeder - Main seeder that calls other seeders
 */
export abstract class DatabaseSeeder extends Seeder {
  /**
   * List of seeders to run
   */
  protected seeders: Array<new () => Seeder> = [];

  /**
   * Run the database seeds.
   */
  async run(): Promise<void> {
    // Override in subclass or use seeders array
    await this.callMany(this.seeders);
  }

  /**
   * Register seeders to run
   */
  register(...seeders: Array<new () => Seeder>): this {
    this.seeders.push(...seeders);
    return this;
  }
}

/**
 * Seeder Runner - Executes seeders with advanced options
 */
export class SeederRunner {
  private seedersPath: string;
  private options: SeederOptions = {};
  private eventListeners: Map<SeederEventType, SeederEventListener[]> =
    new Map();

  constructor(seedersPath: string) {
    this.seedersPath = seedersPath;
  }

  /**
   * Set runner options
   */
  setOptions(options: SeederOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Add event listener
   */
  on(event: SeederEventType, listener: SeederEventListener): this {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
    return this;
  }

  /**
   * Run main DatabaseSeeder
   */
  async run(): Promise<SeederStats> {
    return this.runSeeder("DatabaseSeeder");
  }

  /**
   * Run a specific seeder by name
   */
  async runSeeder(seederName: string): Promise<SeederStats> {
    const path = await import("path");
    const seederPath = path.resolve(this.seedersPath, seederName + ".ts");

    const SeederModule = ModuleLoader.require(seederPath);
    const SeederClass = SeederModule.default || SeederModule;

    const seeder = new SeederClass() as Seeder;
    seeder.setOptions(this.options);

    // Copy event listeners
    for (const [event, listeners] of this.eventListeners) {
      for (const listener of listeners) {
        seeder.on(event, listener);
      }
    }

    console.log("\x1b[34mRunning seeders...\x1b[0m\n");
    const startTime = Date.now();

    const stats = await seeder.execute(this.options);

    const totalDuration = Date.now() - startTime;
    console.log(
      `\n\x1b[32mSeeding completed!\x1b[0m ${stats.recordsCreated} records created in ${totalDuration}ms`
    );

    return stats;
  }

  /**
   * Run multiple seeders
   */
  async runMany(seederNames: string[]): Promise<SeederStats> {
    const combinedStats: SeederStats = {
      seedersRun: 0,
      recordsCreated: 0,
      totalDuration: 0,
      errors: 0,
      skipped: 0,
    };

    for (const name of seederNames) {
      const stats = await this.runSeeder(name);
      combinedStats.seedersRun += stats.seedersRun;
      combinedStats.recordsCreated += stats.recordsCreated;
      combinedStats.totalDuration += stats.totalDuration;
      combinedStats.errors += stats.errors;
      combinedStats.skipped += stats.skipped;
    }

    return combinedStats;
  }
}
