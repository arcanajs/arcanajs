import fs from "fs";
import path from "path";
import { ServiceProvider } from "../../server/support/ServiceProvider";
import { dynamicRequireSync } from "../../server/utils/dynamicRequire";
import { Model } from "../Model";
import { Schema } from "../schema";
import { DatabaseAdapter } from "../types";

export class DatabaseProvider extends ServiceProvider {
  async register() {
    let databaseConfig: any;

    // Try multiple possible config paths
    const possiblePaths = [
      path.resolve(process.cwd(), "dist/config/database.js"),
      path.resolve(process.cwd(), "dist/config/database.ts"),
      path.resolve(process.cwd(), "src/config/database.ts"),
      path.resolve(process.cwd(), "src/config/database.js"),
    ];

    let configLoaded = false;
    for (const configPath of possiblePaths) {
      // Check if file exists before trying to load it
      if (!fs.existsSync(configPath)) {
        continue;
      }

      try {
        const required = dynamicRequireSync(configPath);
        databaseConfig =
          required.default || required.databaseConfig || required;
        configLoaded = true;
        break;
      } catch (err) {
        // Try next path
        console.warn(`Failed to load database config from ${configPath}:`, err);
        continue;
      }
    }

    if (!configLoaded) {
      console.warn("No database config found. Skipping database setup.");
      console.warn("Tried paths:", possiblePaths);
      return;
    }

    // At this point, databaseConfig is guaranteed to be defined

    const adapter: DatabaseAdapter = (() => {
      switch (databaseConfig.type) {
        case "mysql":
          return new (require("../adapters/MySQLAdapter").default)();
        case "mongodb":
          return new (require("../adapters/MongoAdapter").default)();
        case "postgres":
          return new (require("../adapters/PostgresAdapter").default)();
        default:
          throw new Error(`Unsupported DB type ${databaseConfig.type}`);
      }
    })();

    this.app.container.singleton("DatabaseAdapter", () => adapter);

    this.app.container.singleton("DBConnection", async () => {
      const conn = await adapter.connect(databaseConfig);
      Model.setAdapter(adapter);
      Schema.setAdapter(adapter);
      console.log(
        `Connected to ${databaseConfig.type} database: ${databaseConfig.database}`
      );
      return conn;
    });
  }

  async shutdown() {
    try {
      const adapter = (await this.app.container.make(
        "DatabaseAdapter"
      )) as DatabaseAdapter;
      await adapter.disconnect();
      console.log("Database connection closed.");
    } catch (err) {
      // No database configured or already closed
    }
  }
}
