import { ServiceProvider } from "../../server/support/ServiceProvider";
import { Model } from "../Model";
import { Schema } from "../schema";
import { DatabaseAdapter } from "../types";

/**
 * Database Service Provider
 *
 * Registers and bootstraps the database system
 */
export class DatabaseProvider extends ServiceProvider {
  async register() {
    console.log("⚙️  DatabaseProvider: Initializing...");

    // Get config from container (loaded by ArcanaJSServer)
    let databaseConfig: any;

    try {
      databaseConfig = this.app.container.resolve("DatabaseConfig");
      console.log("✓ DatabaseProvider: Configuration loaded successfully");
    } catch (err) {
      console.warn(
        "⚠ DatabaseProvider: No configuration found - Skipping setup"
      );
      return;
    }

    try {
      // Load appropriate adapter
      console.log(
        `⚙️  DatabaseProvider: Loading ${databaseConfig.type} adapter...`
      );
      let adapter: DatabaseAdapter;

      switch (databaseConfig.type) {
        case "mysql":
          const { MySQLAdapter } = await import("../adapters/MySQLAdapter");
          adapter = new MySQLAdapter();
          break;
        case "mongodb":
          const { MongoAdapter } = await import("../adapters/MongoAdapter");
          adapter = new MongoAdapter();
          break;
        case "postgres":
          const { PostgresAdapter } = await import(
            "../adapters/PostgresAdapter"
          );
          adapter = new PostgresAdapter();
          break;
        default:
          throw new Error(`Unsupported database type: ${databaseConfig.type}`);
      }

      console.log(`✓ DatabaseProvider: ${databaseConfig.type} adapter loaded`);

      // Register adapter in container
      this.app.container.singleton("DatabaseAdapter", () => adapter);

      // Register connection factory
      this.app.container.singleton("DBConnection", async () => {
        console.log(
          `⚙️  DatabaseProvider: Connecting to ${databaseConfig.type}...`
        );
        const conn = await adapter.connect(databaseConfig);
        Model.setAdapter(adapter);
        Schema.setAdapter(adapter);
        console.log(
          `✓ DatabaseProvider: Connected to ${databaseConfig.type} database '${databaseConfig.database}'`
        );
        return conn;
      });

      console.log("✅ DatabaseProvider: Ready");
    } catch (error) {
      console.error("✗ DatabaseProvider: Initialization failed", error);
      throw error;
    }
  }

  async shutdown() {
    try {
      console.log("⚙️  DatabaseProvider: Closing connection...");
      const adapter = (await this.app.container.make(
        "DatabaseAdapter"
      )) as DatabaseAdapter;
      await adapter.disconnect();
      console.log("✓ DatabaseProvider: Connection closed");
    } catch (err) {
      // No database configured or already closed
    }
  }
}
