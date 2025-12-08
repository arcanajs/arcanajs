import path from "path";
import { Model } from "../../lib/arcanox/Model";
import { Container } from "../../lib/di/Container";
import { ModuleLoader } from "../../utils/ModuleLoader";

export const handleDb = async (args: string[]) => {
  const command = args[0]; // db:seed

  if (command !== "db:seed") {
    console.error(`Unknown db command: ${command}`);
    process.exit(1);
  }

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
    console.log("✓ DB: Configuration loaded successfully");
  } catch (err) {
    console.warn("⚠ DB: No configuration found - Skipping setup");
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
    Model.setAdapter(adapter); // Set adapter for Models used in seeders

    // Set global adapter for user's Arcanox instance
    global.ArcanaDatabaseAdapter = adapter;

    // Load DatabaseSeeder
    const seederPath = path.resolve(
      process.cwd(),
      "src/database/seeders/DatabaseSeeder.ts"
    );
    const seederModule = ModuleLoader.require(seederPath);
    const DatabaseSeeder = seederModule.default || seederModule.DatabaseSeeder;

    if (!DatabaseSeeder) {
      throw new Error("DatabaseSeeder not found");
    }

    console.log("Seeding database...");
    const seeder = new DatabaseSeeder();
    await seeder.run();
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await adapter.disconnect();
  }
};
