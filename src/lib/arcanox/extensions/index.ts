/**
 * Arcanox Extensions Index
 * Database-specific query builder extensions
 */

// MongoDB Extensions - Mongoose-style functionality
export * from "./MongoExtensions";

// PostgreSQL Extensions - JSONB, Full-text search, Window functions
export * from "./PostgresExtensions";

// MySQL Extensions - JSON, Full-text search, Spatial queries
export * from "./MySQLExtensions";

/**
 * Extension Loader
 * Utility to load extensions based on database type
 */
export class ExtensionLoader {
  private static loadedExtensions: Set<string> = new Set();

  /**
   * Load MongoDB extensions
   */
  static loadMongo(): void {
    if (!this.loadedExtensions.has("mongo")) {
      require("./MongoExtensions");
      this.loadedExtensions.add("mongo");
    }
  }

  /**
   * Load PostgreSQL extensions
   */
  static loadPostgres(): void {
    if (!this.loadedExtensions.has("postgres")) {
      require("./PostgresExtensions");
      this.loadedExtensions.add("postgres");
    }
  }

  /**
   * Load MySQL extensions
   */
  static loadMySQL(): void {
    if (!this.loadedExtensions.has("mysql")) {
      require("./MySQLExtensions");
      this.loadedExtensions.add("mysql");
    }
  }

  /**
   * Load all extensions
   */
  static loadAll(): void {
    this.loadMongo();
    this.loadPostgres();
    this.loadMySQL();
  }

  /**
   * Load extensions based on adapter type
   */
  static loadForAdapter(
    adapterType: "mongodb" | "postgres" | "mysql" | "pg"
  ): void {
    switch (adapterType) {
      case "mongodb":
        this.loadMongo();
        break;
      case "postgres":
      case "pg":
        this.loadPostgres();
        break;
      case "mysql":
        this.loadMySQL();
        break;
    }
  }

  /**
   * Check if extension is loaded
   */
  static isLoaded(extension: "mongo" | "postgres" | "mysql"): boolean {
    return this.loadedExtensions.has(extension);
  }

  /**
   * Get list of loaded extensions
   */
  static getLoaded(): string[] {
    return Array.from(this.loadedExtensions);
  }
}

/**
 * Auto-loader function for use in adapter initialization
 */
export function autoLoadExtensions(adapterType: string): void {
  const type = adapterType.toLowerCase();

  if (type.includes("mongo")) {
    ExtensionLoader.loadMongo();
  } else if (type.includes("postgres") || type.includes("pg")) {
    ExtensionLoader.loadPostgres();
  } else if (type.includes("mysql") || type.includes("maria")) {
    ExtensionLoader.loadMySQL();
  }
}
