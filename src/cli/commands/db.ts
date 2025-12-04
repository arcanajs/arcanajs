import path from "path";
import { MongoAdapter } from "../../lib/arcanox/adapters/MongoAdapter";
import { MySQLAdapter } from "../../lib/arcanox/adapters/MySQLAdapter";
import { PostgresAdapter } from "../../lib/arcanox/adapters/PostgresAdapter";
import { Model } from "../../lib/arcanox/Model";

export const handleDb = async (args: string[]) => {
  const command = args[0]; // db:seed

  if (command !== "db:seed") {
    console.error(`Unknown db command: ${command}`);
    process.exit(1);
  }

  // Load config
  const configPath = path.resolve(process.cwd(), "src/config/database");

  try {
    require("ts-node").register({
      transpileOnly: true,
      compilerOptions: {
        module: "commonjs",
      },
    });
  } catch (e) {}

  // Use dynamic require to avoid webpack bundling user project files
  const { dynamicRequire } = require("../../lib/server/utils/dynamicRequire");

  let config;
  try {
    const module = dynamicRequire(configPath);
    config = module.default || module.databaseConfig || module;
  } catch (error) {
    console.error("Failed to load database config:", error);
    process.exit(1);
  }

  // Connect to DB
  let adapter;
  if (config.type === "postgres") {
    adapter = new PostgresAdapter();
  } else if (config.type === "mongodb") {
    adapter = new MongoAdapter();
  } else if (config.type === "mysql") {
    adapter = new MySQLAdapter();
  } else {
    console.error(`Unsupported database type: ${config.type}`);
    process.exit(1);
  }

  try {
    await adapter.connect(config);
    Model.setAdapter(adapter); // Set adapter for Models used in seeders

    // Load DatabaseSeeder
    const seederPath = path.resolve(
      process.cwd(),
      "database/seeders/DatabaseSeeder.ts"
    );
    const seederModule = dynamicRequire(seederPath);
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
