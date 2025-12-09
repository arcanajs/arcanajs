import type { DatabaseAdapter } from "../types";
import { Blueprint } from "./Blueprint";

/**
 * Schema - ArcnanJS schema builder
 * Provides fluent interface for creating and modifying database tables
 */
declare global {
  var ArcanajsDatabaseAdapter: DatabaseAdapter | undefined;
}

/**
 * Schema - ArcnanJS schema builder
 * Provides fluent interface for creating and modifying database tables
 */
export class Schema {
  private static adapter: DatabaseAdapter;

  /**
   * Get the database adapter
   */
  private static getAdapter(): DatabaseAdapter {
    const adapter = this.adapter || global.ArcanaJSDatabaseAdapter;
    if (!adapter) {
      throw new Error(
        "Database adapter not set. Call Schema.setAdapter() or ensure global.ArcanaJSDatabaseAdapter is set."
      );
    }
    return adapter;
  }

  /**
   * Set the database adapter
   */
  static setAdapter(adapter: DatabaseAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Create a new table
   */
  static async create(
    tableName: string,
    callback: (table: Blueprint) => void
  ): Promise<void> {
    const blueprint = new Blueprint(tableName);
    callback(blueprint);

    await this.getAdapter().createTable(tableName, blueprint.getColumns());
  }

  /**
   * Modify an existing table
   */
  static async table(
    tableName: string,
    callback: (table: Blueprint) => void
  ): Promise<void> {
    const blueprint = new Blueprint(tableName);
    callback(blueprint);

    // For now, this is a simplified implementation
    // In a full implementation, this would generate ALTER TABLE statements
    console.warn(
      "Schema.table() is not fully implemented yet. Use migrations for complex alterations."
    );
  }

  /**
   * Drop a table
   */
  static async drop(tableName: string): Promise<void> {
    await this.getAdapter().dropTable(tableName);
  }

  /**
   * Drop a table if it exists
   */
  static async dropIfExists(tableName: string): Promise<void> {
    const exists = await this.hasTable(tableName);
    if (exists) {
      await this.drop(tableName);
    }
  }

  /**
   * Rename a table
   */
  static async rename(from: string, to: string): Promise<void> {
    // This would need to be implemented in the adapter
    throw new Error("Schema.rename() not yet implemented");
  }

  /**
   * Check if a table exists
   */
  static async hasTable(tableName: string): Promise<boolean> {
    return await this.getAdapter().hasTable(tableName);
  }

  /**
   * Check if a column exists in a table
   */
  static async hasColumn(
    tableName: string,
    columnName: string
  ): Promise<boolean> {
    return await this.getAdapter().hasColumn(tableName, columnName);
  }

  /**
   * Get all tables
   */
  static async getTables(): Promise<string[]> {
    // This would need to be implemented in the adapter
    throw new Error("Schema.getTables() not yet implemented");
  }

  /**
   * Get all columns for a table
   */
  static async getColumns(tableName: string): Promise<string[]> {
    // This would need to be implemented in the adapter
    throw new Error("Schema.getColumns() not yet implemented");
  }
}
