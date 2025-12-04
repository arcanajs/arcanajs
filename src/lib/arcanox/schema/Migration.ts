import { dynamicRequireSync } from "../../server/utils/dynamicRequire";
import { Schema } from "./Schema";

/**
 * Base Migration class
 * All migrations should extend this class and implement up() and down() methods
 */
export abstract class Migration {
  /**
   * Run the migration
   */
  abstract up(): Promise<void>;

  /**
   * Reverse the migration
   */
  abstract down(): Promise<void>;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  name: string;
  batch: number;
  ranAt: Date;
}

/**
 * Migration record in database
 */
export interface MigrationRecord {
  id?: number;
  migration: string;
  batch: number;
  created_at?: Date;
}

/**
 * Migration Runner - executes migrations
 */
export class MigrationRunner {
  private adapter: any;
  private migrationsTable: string = "migrations";
  private migrationsPath: string;

  constructor(adapter: any, migrationsPath: string) {
    this.adapter = adapter;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const exists = await Schema.hasTable(this.migrationsTable);
    if (!exists) {
      await Schema.create(this.migrationsTable, (table) => {
        table.id();
        table.string("migration");
        table.integer("batch");
        table.timestamp("created_at").nullable();
      });
    }
  }

  /**
   * Get all ran migrations
   */
  private async getRanMigrations(): Promise<MigrationRecord[]> {
    await this.ensureMigrationsTable();
    return await this.adapter.select(this.migrationsTable, {
      orderBy: [{ column: "batch", direction: "ASC" }],
    });
  }

  /**
   * Get pending migrations
   */
  private async getPendingMigrations(): Promise<string[]> {
    const fs = await import("fs");
    const path = await import("path");

    const ranMigrations = await this.getRanMigrations();
    const ranNames = ranMigrations.map((m) => m.migration);

    const files = fs.readdirSync(this.migrationsPath);
    const migrationFiles = files
      .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
      .filter((f) => !ranNames.includes(f.replace(/\.(ts|js)$/, "")))
      .sort();

    return migrationFiles;
  }

  /**
   * Run pending migrations
   */
  async run(): Promise<void> {
    const path = await import("path");
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations");
      return;
    }

    const ranMigrations = await this.getRanMigrations();
    const nextBatch =
      ranMigrations.length > 0
        ? Math.max(...ranMigrations.map((m) => m.batch)) + 1
        : 1;

    console.log(`Running ${pendingMigrations.length} migration(s)...`);

    for (const file of pendingMigrations) {
      const migrationPath = path.resolve(this.migrationsPath, file);
      const migrationName = file.replace(/\.(ts|js)$/, "");

      try {
        // Dynamic import of migration
        const MigrationClass = await this.loadMigration(migrationPath);
        const migration = new MigrationClass();

        console.log(`Migrating: ${migrationName}`);
        await migration.up();

        // Record migration
        await this.adapter.insert(this.migrationsTable, {
          migration: migrationName,
          batch: nextBatch,
          created_at: new Date(),
        });

        console.log(`Migrated: ${migrationName}`);
      } catch (error) {
        console.error(`Failed to migrate ${migrationName}:`, error);
        throw error;
      }
    }

    console.log("Migrations completed successfully");
  }

  /**
   * Rollback last batch of migrations
   */
  async rollback(steps: number = 1): Promise<void> {
    const ranMigrations = await this.getRanMigrations();

    if (ranMigrations.length === 0) {
      console.log("No migrations to rollback");
      return;
    }

    const maxBatch = Math.max(...ranMigrations.map((m) => m.batch));
    const minBatch = maxBatch - steps + 1;

    const migrationsToRollback = ranMigrations
      .filter((m) => m.batch >= minBatch && m.batch <= maxBatch)
      .reverse();

    console.log(`Rolling back ${migrationsToRollback.length} migration(s)...`);

    const path = await import("path");

    for (const record of migrationsToRollback) {
      const migrationPath = path.resolve(
        this.migrationsPath,
        `${record.migration}.ts`
      );

      try {
        const MigrationClass = await this.loadMigration(migrationPath);
        const migration = new MigrationClass();

        console.log(`Rolling back: ${record.migration}`);
        await migration.down();

        // Remove migration record
        await this.adapter.delete(this.migrationsTable, record.id);

        console.log(`Rolled back: ${record.migration}`);
      } catch (error) {
        console.error(`Failed to rollback ${record.migration}:`, error);
        throw error;
      }
    }

    console.log("Rollback completed successfully");
  }

  /**
   * Reset all migrations
   */
  async reset(): Promise<void> {
    const ranMigrations = await this.getRanMigrations();
    const batches = Math.max(...ranMigrations.map((m) => m.batch));
    await this.rollback(batches);
  }

  /**
   * Reset and re-run all migrations
   */
  async fresh(): Promise<void> {
    await this.reset();
    await this.run();
  }

  /**
   * Get migration status
   */
  async status(): Promise<MigrationStatus[]> {
    const ranMigrations = await this.getRanMigrations();
    return ranMigrations.map((m) => ({
      name: m.migration,
      batch: m.batch,
      ranAt: m.created_at || new Date(),
    }));
  }

  /**
   * Load migration class from file
   */
  private async loadMigration(filePath: string): Promise<any> {
    // Use dynamic require to avoid webpack bundling
    const migrationModule = dynamicRequireSync(filePath);
    const MigrationClass = migrationModule.default || migrationModule;

    if (!MigrationClass || typeof MigrationClass !== "function") {
      throw new Error(
        `Migration file ${filePath} does not export a valid migration class`
      );
    }

    // Validate that it's a concrete class extending Migration
    // Check if the class has the required methods
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
}
