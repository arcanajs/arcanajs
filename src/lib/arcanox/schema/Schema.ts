import type { ColumnDefinition, DatabaseAdapter, DatabaseType } from "../types";
import { Blueprint } from "./Blueprint";

/**
 * Schema grammar interface for database-specific SQL generation
 */
export interface SchemaGrammar {
  compileCreate(blueprint: Blueprint): string;
  compileAlter(blueprint: Blueprint): string[];
  compileDrop(tableName: string): string;
  compileDropIfExists(tableName: string): string;
  compileRename(from: string, to: string): string;
  compileColumnType(column: ColumnDefinition): string;
  compileColumnModifiers(column: ColumnDefinition): string;
  compileIndex(
    tableName: string,
    columns: string[],
    unique: boolean,
    name?: string,
    type?: string
  ): string;
  compileForeignKey(tableName: string, definition: any): string;
  compileDropIndex(tableName: string, indexName: string): string;
  compileDropForeign(tableName: string, foreignKeyName: string): string;
}

/**
 * PostgreSQL Schema Grammar
 */
export class PostgresSchemaGrammar implements SchemaGrammar {
  compileCreate(blueprint: Blueprint): string {
    const columns = blueprint
      .getColumns()
      .map((col) => {
        return `"${col.name}" ${this.compileColumnType(
          col
        )}${this.compileColumnModifiers(col)}`;
      })
      .join(", ");

    const options = blueprint.getTableOptions();
    let sql = options.temporary ? "CREATE TEMPORARY TABLE " : "CREATE TABLE ";
    sql += options.ifNotExists ? "IF NOT EXISTS " : "";
    sql += `"${blueprint.getTableName()}" (${columns})`;

    return sql;
  }

  compileAlter(blueprint: Blueprint): string[] {
    const statements: string[] = [];
    const tableName = blueprint.getTableName();

    // Drop columns
    for (const col of blueprint.getDropColumns()) {
      statements.push(
        `ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${col}"`
      );
    }

    // Rename columns
    for (const rename of blueprint.getRenameColumns()) {
      statements.push(
        `ALTER TABLE "${tableName}" RENAME COLUMN "${rename.from}" TO "${rename.to}"`
      );
    }

    // Add/modify columns
    for (const col of blueprint.getColumns()) {
      if ((col as any).change) {
        statements.push(
          `ALTER TABLE "${tableName}" ALTER COLUMN "${
            col.name
          }" TYPE ${this.compileColumnType(col)}`
        );
      } else {
        statements.push(
          `ALTER TABLE "${tableName}" ADD COLUMN "${
            col.name
          }" ${this.compileColumnType(col)}${this.compileColumnModifiers(col)}`
        );
      }
    }

    // Drop indexes
    for (const indexName of blueprint.getDropIndexes()) {
      statements.push(`DROP INDEX IF EXISTS "${indexName}"`);
    }

    // Drop foreign keys
    for (const fkName of blueprint.getDropForeignKeys()) {
      statements.push(
        `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${fkName}"`
      );
    }

    return statements;
  }

  compileDrop(tableName: string): string {
    return `DROP TABLE "${tableName}"`;
  }

  compileDropIfExists(tableName: string): string {
    return `DROP TABLE IF EXISTS "${tableName}"`;
  }

  compileRename(from: string, to: string): string {
    return `ALTER TABLE "${from}" RENAME TO "${to}"`;
  }

  compileColumnType(column: ColumnDefinition): string {
    const typeMap: Record<string, string> = {
      bigInteger: "BIGINT",
      integer: "INTEGER",
      smallInteger: "SMALLINT",
      tinyInteger: "SMALLINT",
      mediumInteger: "INTEGER",
      decimal: `DECIMAL(${(column as any).precision || 10}, ${
        (column as any).scale || 2
      })`,
      float: "REAL",
      double: "DOUBLE PRECISION",
      boolean: "BOOLEAN",
      string: `VARCHAR(${column.length || 255})`,
      char: `CHAR(${column.length || 255})`,
      text: "TEXT",
      mediumText: "TEXT",
      longText: "TEXT",
      tinyText: "TEXT",
      binary: "BYTEA",
      blob: "BYTEA",
      uuid: "UUID",
      json: "JSON",
      jsonb: "JSONB",
      date: "DATE",
      datetime: "TIMESTAMP",
      datetimeTz: "TIMESTAMPTZ",
      timestamp: "TIMESTAMP",
      timestampTz: "TIMESTAMPTZ",
      time: "TIME",
      timeTz: "TIMETZ",
      year: "INTEGER",
      inet: "INET",
      cidr: "CIDR",
      macaddr: "MACADDR",
      macaddr8: "MACADDR8",
      money: "MONEY",
      geometry: "GEOMETRY",
      geography: "GEOGRAPHY",
      point: "POINT",
      int4range: "INT4RANGE",
      int8range: "INT8RANGE",
      numrange: "NUMRANGE",
      tsrange: "TSRANGE",
      tstzrange: "TSTZRANGE",
      daterange: "DATERANGE",
      tsvector: "TSVECTOR",
      tsquery: "TSQUERY",
      xml: "XML",
      hstore: "HSTORE",
      interval: "INTERVAL",
    };

    return typeMap[column.type] || column.type.toUpperCase();
  }

  compileColumnModifiers(column: ColumnDefinition): string {
    let sql = "";

    if (column.autoIncrement) {
      sql = sql.replace(
        /BIGINT|INTEGER|SMALLINT/,
        column.type === "bigInteger" ? "BIGSERIAL" : "SERIAL"
      );
    }

    if (!column.nullable && !column.autoIncrement) {
      sql += " NOT NULL";
    }

    if (column.default !== undefined) {
      sql += ` DEFAULT ${this.formatDefault(column.default)}`;
    }

    if (column.unique) {
      sql += " UNIQUE";
    }

    if (column.primary && !column.autoIncrement) {
      sql += " PRIMARY KEY";
    }

    return sql;
  }

  private formatDefault(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") {
      if (value.includes("(") || value.toUpperCase().startsWith("CURRENT")) {
        return value;
      }
      return `'${value}'`;
    }
    return String(value);
  }

  compileIndex(
    tableName: string,
    columns: string[],
    unique: boolean,
    name?: string,
    type?: string
  ): string {
    const indexName =
      name ||
      `${tableName}_${columns.join("_")}_${unique ? "unique" : "index"}`;
    const indexType = type ? ` USING ${type.toUpperCase()}` : "";
    const uniqueKeyword = unique ? "UNIQUE " : "";
    return `CREATE ${uniqueKeyword}INDEX "${indexName}" ON "${tableName}"${indexType} (${columns
      .map((c) => `"${c}"`)
      .join(", ")})`;
  }

  compileForeignKey(tableName: string, definition: any): string {
    const columns = definition.columns.map((c: string) => `"${c}"`).join(", ");
    const refColumns = definition.referencedColumns
      .map((c: string) => `"${c}"`)
      .join(", ");
    let sql = `ALTER TABLE "${tableName}" ADD CONSTRAINT "${
      definition.name || `${tableName}_${definition.columns.join("_")}_foreign`
    }" `;
    sql += `FOREIGN KEY (${columns}) REFERENCES "${definition.referencedTable}" (${refColumns})`;
    if (definition.onDelete) sql += ` ON DELETE ${definition.onDelete}`;
    if (definition.onUpdate) sql += ` ON UPDATE ${definition.onUpdate}`;
    return sql;
  }

  compileDropIndex(tableName: string, indexName: string): string {
    return `DROP INDEX IF EXISTS "${indexName}"`;
  }

  compileDropForeign(tableName: string, foreignKeyName: string): string {
    return `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${foreignKeyName}"`;
  }
}

/**
 * MySQL Schema Grammar
 */
export class MySQLSchemaGrammar implements SchemaGrammar {
  compileCreate(blueprint: Blueprint): string {
    const columns = blueprint
      .getColumns()
      .map((col) => {
        return `\`${col.name}\` ${this.compileColumnType(
          col
        )}${this.compileColumnModifiers(col)}`;
      })
      .join(", ");

    const options = blueprint.getTableOptions();
    let sql = options.temporary ? "CREATE TEMPORARY TABLE " : "CREATE TABLE ";
    sql += options.ifNotExists ? "IF NOT EXISTS " : "";
    sql += `\`${blueprint.getTableName()}\` (${columns})`;

    if (options.engine) sql += ` ENGINE=${options.engine}`;
    if (options.charset) sql += ` DEFAULT CHARSET=${options.charset}`;
    if (options.collation) sql += ` COLLATE=${options.collation}`;
    if (options.comment) sql += ` COMMENT='${options.comment}'`;

    return sql;
  }

  compileAlter(blueprint: Blueprint): string[] {
    const statements: string[] = [];
    const tableName = blueprint.getTableName();

    for (const col of blueprint.getDropColumns()) {
      statements.push(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${col}\``);
    }

    for (const rename of blueprint.getRenameColumns()) {
      statements.push(
        `ALTER TABLE \`${tableName}\` RENAME COLUMN \`${rename.from}\` TO \`${rename.to}\``
      );
    }

    for (const col of blueprint.getColumns()) {
      if ((col as any).change) {
        statements.push(
          `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${
            col.name
          }\` ${this.compileColumnType(col)}${this.compileColumnModifiers(col)}`
        );
      } else {
        let addSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${
          col.name
        }\` ${this.compileColumnType(col)}${this.compileColumnModifiers(col)}`;
        if ((col as any).after) addSql += ` AFTER \`${(col as any).after}\``;
        if ((col as any).first) addSql += " FIRST";
        statements.push(addSql);
      }
    }

    return statements;
  }

  compileDrop(tableName: string): string {
    return `DROP TABLE \`${tableName}\``;
  }

  compileDropIfExists(tableName: string): string {
    return `DROP TABLE IF EXISTS \`${tableName}\``;
  }

  compileRename(from: string, to: string): string {
    return `RENAME TABLE \`${from}\` TO \`${to}\``;
  }

  compileColumnType(column: ColumnDefinition): string {
    const unsigned = column.unsigned ? " UNSIGNED" : "";

    const typeMap: Record<string, string> = {
      bigInteger: `BIGINT${unsigned}`,
      integer: `INT${unsigned}`,
      smallInteger: `SMALLINT${unsigned}`,
      tinyInteger: `TINYINT${unsigned}`,
      mediumInteger: `MEDIUMINT${unsigned}`,
      decimal: `DECIMAL(${(column as any).precision || 10}, ${
        (column as any).scale || 2
      })${unsigned}`,
      float: `FLOAT${unsigned}`,
      double: `DOUBLE${unsigned}`,
      boolean: "TINYINT(1)",
      string: `VARCHAR(${column.length || 255})`,
      char: `CHAR(${column.length || 255})`,
      text: "TEXT",
      mediumText: "MEDIUMTEXT",
      longText: "LONGTEXT",
      tinyText: "TINYTEXT",
      binary: `BINARY(${column.length || 255})`,
      blob: "BLOB",
      mediumBlob: "MEDIUMBLOB",
      longBlob: "LONGBLOB",
      tinyBlob: "TINYBLOB",
      uuid: "CHAR(36)",
      json: "JSON",
      date: "DATE",
      datetime: `DATETIME${
        (column as any).precision ? `(${(column as any).precision})` : ""
      }`,
      timestamp: `TIMESTAMP${
        (column as any).precision ? `(${(column as any).precision})` : ""
      }`,
      time: `TIME${
        (column as any).precision ? `(${(column as any).precision})` : ""
      }`,
      year: "YEAR",
      enum: `ENUM(${((column as any).values || [])
        .map((v: string) => `'${v}'`)
        .join(", ")})`,
      set: `SET(${((column as any).values || [])
        .map((v: string) => `'${v}'`)
        .join(", ")})`,
      geometry: "GEOMETRY",
      point: "POINT",
      linestring: "LINESTRING",
      polygon: "POLYGON",
    };

    return typeMap[column.type] || column.type.toUpperCase();
  }

  compileColumnModifiers(column: ColumnDefinition): string {
    let sql = "";

    if (
      column.unsigned &&
      ![
        "bigInteger",
        "integer",
        "smallInteger",
        "tinyInteger",
        "mediumInteger",
        "decimal",
        "float",
        "double",
      ].includes(column.type)
    ) {
      sql += " UNSIGNED";
    }

    if (!column.nullable) {
      sql += " NOT NULL";
    } else {
      sql += " NULL";
    }

    if (column.autoIncrement) {
      sql += " AUTO_INCREMENT";
    }

    if (column.default !== undefined && !column.autoIncrement) {
      sql += ` DEFAULT ${this.formatDefault(column.default, column)}`;
    }

    if (column.unique) {
      sql += " UNIQUE";
    }

    if (column.primary) {
      sql += " PRIMARY KEY";
    }

    if (column.comment) {
      sql += ` COMMENT '${column.comment}'`;
    }

    return sql;
  }

  private formatDefault(value: any, column: ColumnDefinition): string {
    if (value === null) return "NULL";
    if (typeof value === "boolean") return value ? "1" : "0";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") {
      if (value.toUpperCase() === "CURRENT_TIMESTAMP" || value.includes("(")) {
        return value;
      }
      return `'${value}'`;
    }
    return String(value);
  }

  compileIndex(
    tableName: string,
    columns: string[],
    unique: boolean,
    name?: string,
    type?: string
  ): string {
    const indexName =
      name || `${tableName}_${columns.join("_")}_${unique ? "unique" : "idx"}`;
    const indexType =
      type === "fulltext" ? "FULLTEXT " : type === "spatial" ? "SPATIAL " : "";
    const uniqueKeyword = unique && !indexType ? "UNIQUE " : "";
    return `CREATE ${uniqueKeyword}${indexType}INDEX \`${indexName}\` ON \`${tableName}\` (${columns
      .map((c) => `\`${c}\``)
      .join(", ")})`;
  }

  compileForeignKey(tableName: string, definition: any): string {
    const columns = definition.columns
      .map((c: string) => `\`${c}\``)
      .join(", ");
    const refColumns = definition.referencedColumns
      .map((c: string) => `\`${c}\``)
      .join(", ");
    let sql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${
      definition.name || `${tableName}_${definition.columns.join("_")}_foreign`
    }\` `;
    sql += `FOREIGN KEY (${columns}) REFERENCES \`${definition.referencedTable}\` (${refColumns})`;
    if (definition.onDelete) sql += ` ON DELETE ${definition.onDelete}`;
    if (definition.onUpdate) sql += ` ON UPDATE ${definition.onUpdate}`;
    return sql;
  }

  compileDropIndex(tableName: string, indexName: string): string {
    return `DROP INDEX \`${indexName}\` ON \`${tableName}\``;
  }

  compileDropForeign(tableName: string, foreignKeyName: string): string {
    return `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${foreignKeyName}\``;
  }
}

/**
 * Schema builder event types
 */
export type SchemaEvent =
  | "creating"
  | "created"
  | "altering"
  | "altered"
  | "dropping"
  | "dropped";

/**
 * Schema builder event listener
 */
export type SchemaEventListener = (
  tableName: string,
  blueprint?: Blueprint
) => void | Promise<void>;

/**
 * Schema - Professional Schema Builder
 * Provides fluent interface for creating and modifying database tables
 * Supports PostgreSQL, MySQL, and MongoDB
 */
export class Schema {
  private static adapter: DatabaseAdapter;
  private static grammar: SchemaGrammar;
  private static databaseType: DatabaseType = "postgres";
  private static eventListeners: Map<SchemaEvent, SchemaEventListener[]> =
    new Map();
  private static blueprintResolvers: Map<
    string,
    (blueprint: Blueprint) => void
  > = new Map();

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
   * Get the schema grammar based on database type
   */
  private static getGrammar(): SchemaGrammar {
    if (!this.grammar) {
      switch (this.databaseType) {
        case "mysql":
        case "mariadb":
          this.grammar = new MySQLSchemaGrammar();
          break;
        case "postgres":
        default:
          this.grammar = new PostgresSchemaGrammar();
          break;
      }
    }
    return this.grammar;
  }

  /**
   * Set the database adapter
   */
  static setAdapter(
    adapter: DatabaseAdapter,
    type: DatabaseType = "postgres"
  ): void {
    this.adapter = adapter;
    this.databaseType = type;
    this.grammar = undefined as any; // Reset grammar to pick up new type
  }

  /**
   * Set the database type
   */
  static setDatabaseType(type: DatabaseType): void {
    this.databaseType = type;
    this.grammar = undefined as any;
  }

  /**
   * Register an event listener
   */
  static on(event: SchemaEvent, listener: SchemaEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Emit an event
   */
  private static async emit(
    event: SchemaEvent,
    tableName: string,
    blueprint?: Blueprint
  ): Promise<void> {
    const listeners = this.eventListeners.get(event) || [];
    for (const listener of listeners) {
      await listener(tableName, blueprint);
    }
  }

  /**
   * Register a blueprint macro/resolver
   */
  static blueprintMacro(
    name: string,
    resolver: (blueprint: Blueprint) => void
  ): void {
    this.blueprintResolvers.set(name, resolver);
  }

  /**
   * Create a new table
   */
  static async create(
    tableName: string,
    callback: (table: Blueprint) => void
  ): Promise<void> {
    const blueprint = new Blueprint(tableName);

    // Apply any registered blueprint macros
    for (const [name, resolver] of this.blueprintResolvers) {
      (blueprint as any)[name] = () => resolver(blueprint);
    }

    callback(blueprint);

    await this.emit("creating", tableName, blueprint);

    // For MongoDB, use native collection creation
    if (this.databaseType === "mongodb") {
      await this.getAdapter().createTable(tableName, blueprint.getColumns());
    } else {
      // Generate and execute SQL
      const sql = this.getGrammar().compileCreate(blueprint);
      await this.getAdapter().raw(sql);

      // Create indexes
      for (const index of blueprint.getIndexes()) {
        const indexSql = this.getGrammar().compileIndex(
          tableName,
          index.columns,
          index.unique,
          index.name,
          index.type
        );
        await this.getAdapter().raw(indexSql);
      }

      // Create foreign keys
      for (const fk of blueprint.getForeignKeys()) {
        const fkSql = this.getGrammar().compileForeignKey(
          tableName,
          fk.getDefinition()
        );
        await this.getAdapter().raw(fkSql);
      }
    }

    await this.emit("created", tableName, blueprint);
  }

  /**
   * Create table if it doesn't exist
   */
  static async createIfNotExists(
    tableName: string,
    callback: (table: Blueprint) => void
  ): Promise<void> {
    const exists = await this.hasTable(tableName);
    if (!exists) {
      await this.create(tableName, callback);
    }
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

    await this.emit("altering", tableName, blueprint);

    if (this.databaseType === "mongodb") {
      // MongoDB doesn't have traditional ALTER TABLE
      // Handle collection modifications differently
      console.warn(
        "MongoDB collections don't support ALTER operations in the traditional sense."
      );
      return;
    }

    const statements = this.getGrammar().compileAlter(blueprint);
    for (const sql of statements) {
      await this.getAdapter().raw(sql);
    }

    // Create new indexes
    for (const index of blueprint.getIndexes()) {
      const indexSql = this.getGrammar().compileIndex(
        tableName,
        index.columns,
        index.unique,
        index.name,
        index.type
      );
      await this.getAdapter().raw(indexSql);
    }

    // Create new foreign keys
    for (const fk of blueprint.getForeignKeys()) {
      const fkSql = this.getGrammar().compileForeignKey(
        tableName,
        fk.getDefinition()
      );
      await this.getAdapter().raw(fkSql);
    }

    await this.emit("altered", tableName, blueprint);
  }

  /**
   * Drop a table
   */
  static async drop(tableName: string): Promise<void> {
    await this.emit("dropping", tableName);

    if (this.databaseType === "mongodb") {
      await this.getAdapter().dropTable(tableName);
    } else {
      const sql = this.getGrammar().compileDrop(tableName);
      await this.getAdapter().raw(sql);
    }

    await this.emit("dropped", tableName);
  }

  /**
   * Drop a table if it exists
   */
  static async dropIfExists(tableName: string): Promise<void> {
    if (this.databaseType === "mongodb") {
      const exists = await this.hasTable(tableName);
      if (exists) {
        await this.drop(tableName);
      }
    } else {
      const sql = this.getGrammar().compileDropIfExists(tableName);
      await this.getAdapter().raw(sql);
    }
  }

  /**
   * Drop multiple tables
   */
  static async dropAllTables(): Promise<void> {
    const tables = await this.getTables();
    for (const table of tables) {
      await this.drop(table);
    }
  }

  /**
   * Rename a table
   */
  static async rename(from: string, to: string): Promise<void> {
    if (this.databaseType === "mongodb") {
      const adapter = this.getAdapter();
      await adapter.raw(`db.${from}.renameCollection("${to}")`);
    } else {
      const sql = this.getGrammar().compileRename(from, to);
      await this.getAdapter().raw(sql);
    }
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
   * Check if multiple columns exist
   */
  static async hasColumns(
    tableName: string,
    columnNames: string[]
  ): Promise<boolean> {
    for (const column of columnNames) {
      if (!(await this.hasColumn(tableName, column))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all tables in the database
   */
  static async getTables(): Promise<string[]> {
    const adapter = this.getAdapter();

    switch (this.databaseType) {
      case "postgres":
        const pgResult = await adapter.raw(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        );
        return pgResult.map((row: any) => row.tablename);

      case "mysql":
      case "mariadb":
        const mysqlResult = await adapter.raw("SHOW TABLES");
        return mysqlResult.map((row: any) => Object.values(row)[0] as string);

      case "mongodb":
        const db = await adapter.raw("db");
        const collections = await db.listCollections().toArray();
        return collections.map((c: any) => c.name);

      default:
        throw new Error(`getTables not implemented for ${this.databaseType}`);
    }
  }

  /**
   * Get all columns for a table
   */
  static async getColumns(tableName: string): Promise<string[]> {
    const adapter = this.getAdapter();

    switch (this.databaseType) {
      case "postgres":
        const pgResult = await adapter.raw(
          `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public'`
        );
        return pgResult.map((row: any) => row.column_name);

      case "mysql":
      case "mariadb":
        const mysqlResult = await adapter.raw(
          `SHOW COLUMNS FROM \`${tableName}\``
        );
        return mysqlResult.map((row: any) => row.Field);

      case "mongodb":
        // MongoDB doesn't have fixed schema, return sample document keys
        const db = await adapter.raw("db");
        const sample = await db.collection(tableName).findOne();
        return sample ? Object.keys(sample) : [];

      default:
        throw new Error(`getColumns not implemented for ${this.databaseType}`);
    }
  }

  /**
   * Get column types for a table
   */
  static async getColumnTypes(
    tableName: string
  ): Promise<Record<string, string>> {
    const adapter = this.getAdapter();

    switch (this.databaseType) {
      case "postgres":
        const pgResult = await adapter.raw(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public'`
        );
        return pgResult.reduce((acc: Record<string, string>, row: any) => {
          acc[row.column_name] = row.data_type;
          return acc;
        }, {});

      case "mysql":
      case "mariadb":
        const mysqlResult = await adapter.raw(
          `SHOW COLUMNS FROM \`${tableName}\``
        );
        return mysqlResult.reduce((acc: Record<string, string>, row: any) => {
          acc[row.Field] = row.Type;
          return acc;
        }, {});

      default:
        return {};
    }
  }

  /**
   * Get indexes for a table
   */
  static async getIndexes(tableName: string): Promise<any[]> {
    const adapter = this.getAdapter();

    switch (this.databaseType) {
      case "postgres":
        return await adapter.raw(`
          SELECT indexname, indexdef 
          FROM pg_indexes 
          WHERE tablename = '${tableName}'
        `);

      case "mysql":
      case "mariadb":
        return await adapter.raw(`SHOW INDEX FROM \`${tableName}\``);

      case "mongodb":
        const db = await adapter.raw("db");
        return await db.collection(tableName).indexes();

      default:
        return [];
    }
  }

  /**
   * Get foreign keys for a table
   */
  static async getForeignKeys(tableName: string): Promise<any[]> {
    const adapter = this.getAdapter();

    switch (this.databaseType) {
      case "postgres":
        return await adapter.raw(`
          SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = '${tableName}'
        `);

      case "mysql":
      case "mariadb":
        return await adapter.raw(`
          SELECT
            CONSTRAINT_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_NAME = '${tableName}'
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

      default:
        return [];
    }
  }

  /**
   * Enable foreign key constraints
   */
  static async enableForeignKeyConstraints(): Promise<void> {
    switch (this.databaseType) {
      case "postgres":
        // PostgreSQL doesn't have a global FK disable
        break;
      case "mysql":
      case "mariadb":
        await this.getAdapter().raw("SET FOREIGN_KEY_CHECKS = 1");
        break;
    }
  }

  /**
   * Disable foreign key constraints
   */
  static async disableForeignKeyConstraints(): Promise<void> {
    switch (this.databaseType) {
      case "postgres":
        // PostgreSQL doesn't have a global FK disable, need to use SET CONSTRAINTS
        break;
      case "mysql":
      case "mariadb":
        await this.getAdapter().raw("SET FOREIGN_KEY_CHECKS = 0");
        break;
    }
  }

  /**
   * Execute callback with foreign keys disabled
   */
  static async withoutForeignKeyConstraints(
    callback: () => Promise<void>
  ): Promise<void> {
    await this.disableForeignKeyConstraints();
    try {
      await callback();
    } finally {
      await this.enableForeignKeyConstraints();
    }
  }

  /**
   * Truncate a table
   */
  static async truncate(tableName: string): Promise<void> {
    switch (this.databaseType) {
      case "mongodb":
        const adapter = this.getAdapter();
        const db = await adapter.raw("db");
        await db.collection(tableName).deleteMany({});
        break;
      default:
        await this.getAdapter().raw(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }
  }

  /**
   * Get database connection information
   */
  static async getConnection(): Promise<any> {
    return this.getAdapter();
  }

  /**
   * Morphable tables - create tables for polymorphic relationships
   */
  static async morphableTable(
    baseName: string,
    callback?: (table: Blueprint) => void
  ): Promise<void> {
    await this.create(`${baseName}ables`, (table) => {
      table.id();
      table.string(`${baseName}able_type`);
      table.unsignedBigInteger(`${baseName}able_id`);
      table.unsignedBigInteger(`${baseName}_id`);
      table.timestamps();

      table.index([`${baseName}able_type`, `${baseName}able_id`]);

      if (callback) {
        callback(table);
      }
    });
  }
}
