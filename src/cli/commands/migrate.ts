import path from "path";
import { Model } from "../../lib/arcanox/Model";
import { Schema } from "../../lib/arcanox/schema";
import { MigrationRunner } from "../../lib/arcanox/schema/Migration";
import { Container } from "../../lib/di/Container";
import { ModuleLoader } from "../../utils/ModuleLoader";

export const handleMigrate = async (args: string[]) => {
  const command = args[0]; // migrate, migrate:rollback, etc.
  // Load config
  const configPath = path.resolve(process.cwd(), "src/config/database.ts");

  ModuleLoader.registerTsNode();

  let rawConfig;
  try {
    const module = ModuleLoader.require(configPath);
    rawConfig = module.default || module.databaseConfig || module;
  } catch (error) {
    console.error("Failed to load database config:", error);
    process.exit(1);
  }

  // Register config in container (to match DatabaseProvider logic)
  const container = Container.getInstance();
  container.singleton("DatabaseConfig", () => rawConfig);

  let databaseConfig: any;
  try {
    databaseConfig = container.resolve("DatabaseConfig");
    console.log("✓ Migration: Configuration loaded successfully");
  } catch (err) {
    console.warn("⚠ Migration: No configuration found - Skipping setup");
    process.exit(1);
  }

  // Connect to DB
  let adapter;
  try {
    switch (databaseConfig.type) {
      case "mysql":
        const { MySQLAdapter } = await import(
          "../../lib/arcanox/adapters/MySQLAdapter"
        );
        adapter = new MySQLAdapter();
        break;
      case "mongodb":
        const { MongoAdapter } = await import(
          "../../lib/arcanox/adapters/MongoAdapter"
        );
        adapter = new MongoAdapter();
        break;
      case "postgres":
        const { PostgresAdapter } = await import(
          "../../lib/arcanox/adapters/PostgresAdapter"
        );
        adapter = new PostgresAdapter();
        break;
      default:
        throw new Error(`Unsupported database type: ${databaseConfig.type}`);
    }
  } catch (error) {
    console.error("Failed to load database adapter:", error);
    process.exit(1);
  }

  try {
    await adapter.connect(databaseConfig);

    // 1. Configure bundled Arcanox (used by MigrationRunner internal logic)
    Model.setAdapter(adapter);
    Schema.setAdapter(adapter);

    // 2. Set global adapter for user's Arcanox instance (used by migration files imported from node_modules)
    // This solves the split-brain issue by allowing the user's instance to find the adapter globally
    global.ArcanaDatabaseAdapter = adapter;

    const migrationsPath = path.resolve(
      process.cwd(),
      "src/database/migrations"
    );
    const runner = new MigrationRunner(adapter, migrationsPath);

    switch (command) {
      case "migrate":
        await runner.run();
        break;
      case "migrate:rollback":
        await runner.rollback();
        break;
      case "migrate:reset":
        await runner.reset();
        break;
      case "migrate:fresh":
        await runner.fresh();
        break;
      case "migrate:status":
        const status = await runner.status();
        console.table(status);
        break;
      default:
        console.error(`Unknown migrate command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await adapter.disconnect();
  }
};
