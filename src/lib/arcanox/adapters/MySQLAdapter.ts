import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import type {
  AggregateStage,
  ColumnDefinition,
  Connection,
  DatabaseAdapter,
  DatabaseConfig,
  IndexInfo,
  IndexOptions,
  IsolationLevel,
  PoolStats,
  SelectOptions,
  WhereClause,
} from "../types";

/**
 * MySQL/MariaDB Database Adapter
 * Professional MySQL adapter with advanced features, transactions, and connection pooling
 *
 * Arcanox ORM - MySQL Adapter
 */
export class MySQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private connection: PoolConnection | null = null;
  private config: DatabaseConfig | null = null;

  /**
   * Connect to MySQL database
   */
  async connect(config: DatabaseConfig): Promise<Connection> {
    const mysql = ModuleLoader.require("mysql2/promise");
    this.config = config;

    const poolConfig: any = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: config.pool?.max || 10,
      queueLimit: 0,
      connectTimeout: config.connectTimeout || 10000,
      enableKeepAlive: config.keepAlive ?? true,
      keepAliveInitialDelay: config.keepAliveInitialDelay || 10000,
    };

    // SSL configuration
    if (config.ssl) {
      if (typeof config.ssl === "boolean") {
        poolConfig.ssl = config.ssl;
      } else {
        poolConfig.ssl = {
          rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
          ca: config.ssl.ca,
          cert: config.ssl.cert,
          key: config.ssl.key,
        };
      }
    }

    // MySQL-specific options
    if (config.charset) poolConfig.charset = config.charset;
    if (config.collation) poolConfig.collation = config.collation;
    if (config.timezone) poolConfig.timezone = config.timezone;
    if (config.dateStrings !== undefined)
      poolConfig.dateStrings = config.dateStrings;
    if (config.multipleStatements !== undefined)
      poolConfig.multipleStatements = config.multipleStatements;

    this.pool = mysql.createPool(poolConfig);

    // Log connection if enabled
    if (
      config.logging &&
      typeof config.logging === "object" &&
      config.logging.connections
    ) {
      console.log(`[Arcanox MySQL] Connected to ${config.database}`);
    }

    if (config.events?.onConnect) {
      config.events.onConnect();
    }

    return {
      query: this.query.bind(this),
      execute: this.execute.bind(this),
      close: this.disconnect.bind(this),
    };
  }

  /**
   * Disconnect from MySQL
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.release();
      this.connection = null;
    }
    if (this.pool) {
      await this.pool.end();
      if (this.config?.events?.onDisconnect) {
        this.config.events.onDisconnect();
      }
      this.pool = null;
    }
  }

  /**
   * Execute a query and return rows
   */
  async query(sql: string, params?: any[]): Promise<any> {
    const executor = this.connection || this.pool;
    if (!executor) throw new Error("Database not connected");

    const startTime = Date.now();
    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    const duration = Date.now() - startTime;

    this.logQuery(sql, params, duration);

    return rows;
  }

  /**
   * Execute a query and return result metadata
   */
  async execute(sql: string, params?: any[]): Promise<any> {
    const executor = this.connection || this.pool;
    if (!executor) throw new Error("Database not connected");

    const startTime = Date.now();
    const [result] = await executor.execute<ResultSetHeader>(sql, params);
    const duration = Date.now() - startTime;

    this.logQuery(sql, params, duration);

    return result;
  }

  /**
   * Log query execution
   */
  private logQuery(
    sql: string,
    params: any[] | undefined,
    duration: number
  ): void {
    if (this.config?.logging) {
      const logging =
        typeof this.config.logging === "object"
          ? this.config.logging
          : { queries: this.config.logging };

      if (logging.queries) {
        console.log(`[Arcanox MySQL] ${sql}`, params || [], `(${duration}ms)`);
      }

      if (
        logging.slowQueries &&
        this.config.slowQueryThreshold &&
        duration > this.config.slowQueryThreshold
      ) {
        console.warn(
          `[Arcanox MySQL] Slow query (${duration}ms): ${sql}`,
          params
        );
      }
    }

    if (this.config?.events?.onQuery) {
      this.config.events.onQuery(sql, params, duration);
    }

    if (
      this.config?.events?.onSlowQuery &&
      this.config.slowQueryThreshold &&
      duration > this.config.slowQueryThreshold
    ) {
      this.config.events.onSlowQuery(sql, params, duration);
    }
  }

  // ==========================================================================
  // SCHEMA OPERATIONS
  // ==========================================================================

  async createTable(
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    const columnDefs = columns
      .map((col) => {
        let def = `\`${col.name}\` ${this.mapType(
          col.type,
          col.length,
          col.precision,
          col.scale
        )}`;

        if (col.unsigned) def += " UNSIGNED";
        if (col.autoIncrement) def += " AUTO_INCREMENT";
        if (!col.nullable) def += " NOT NULL";
        if (col.default !== undefined) {
          def += ` DEFAULT ${this.formatValue(col.default)}`;
        }
        if (col.primary) def += " PRIMARY KEY";
        if (col.unique && !col.primary) def += " UNIQUE";
        if (col.comment) def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
        if (col.collation) def += ` COLLATE ${col.collation}`;

        return def;
      })
      .join(", ");

    const charset = this.config?.charset || "utf8mb4";
    const collation = this.config?.collation || "utf8mb4_unicode_ci";

    const sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs}) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`;
    await this.execute(sql);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName]
    );
    return result[0]?.count > 0;
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT COUNT(*) as count FROM information_schema.columns 
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [tableName, columnName]
    );
    return result[0]?.count > 0;
  }

  async renameTable(from: string, to: string): Promise<void> {
    await this.execute(`RENAME TABLE \`${from}\` TO \`${to}\``);
  }

  async addColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    let def = `\`${column.name}\` ${this.mapType(
      column.type,
      column.length,
      column.precision,
      column.scale
    )}`;

    if (column.unsigned) def += " UNSIGNED";
    if (!column.nullable) def += " NOT NULL";
    if (column.unique) def += " UNIQUE";
    if (column.default !== undefined) {
      def += ` DEFAULT ${this.formatValue(column.default)}`;
    }
    if (column.comment)
      def += ` COMMENT '${column.comment.replace(/'/g, "''")}'`;
    if (column.after) def += ` AFTER \`${column.after}\``;
    if (column.first) def += " FIRST";

    await this.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN ${def}`);
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    await this.execute(
      `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``
    );
  }

  async renameColumn(
    tableName: string,
    from: string,
    to: string
  ): Promise<void> {
    // Get column definition first
    const columns = await this.query(
      `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT 
       FROM information_schema.columns 
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [tableName, from]
    );

    if (columns.length === 0) {
      throw new Error(`Column ${from} not found in table ${tableName}`);
    }

    const col = columns[0];
    let def = col.COLUMN_TYPE;
    if (col.IS_NULLABLE === "NO") def += " NOT NULL";
    if (col.COLUMN_DEFAULT !== null) def += ` DEFAULT '${col.COLUMN_DEFAULT}'`;
    if (col.EXTRA) def += ` ${col.EXTRA}`;

    await this.execute(
      `ALTER TABLE \`${tableName}\` CHANGE COLUMN \`${from}\` \`${to}\` ${def}`
    );
  }

  async modifyColumn(
    tableName: string,
    column: ColumnDefinition
  ): Promise<void> {
    let def = `\`${column.name}\` ${this.mapType(
      column.type,
      column.length,
      column.precision,
      column.scale
    )}`;

    if (column.unsigned) def += " UNSIGNED";
    if (!column.nullable) def += " NOT NULL";
    if (column.default !== undefined) {
      def += ` DEFAULT ${this.formatValue(column.default)}`;
    }

    await this.execute(`ALTER TABLE \`${tableName}\` MODIFY COLUMN ${def}`);
  }

  // ==========================================================================
  // INDEX OPERATIONS
  // ==========================================================================

  async createIndex(
    tableName: string,
    columns: string[],
    options?: IndexOptions
  ): Promise<void> {
    const indexName = options?.name || `idx_${tableName}_${columns.join("_")}`;
    const unique = options?.unique ? "UNIQUE" : "";
    const indexType = options?.type ? `USING ${options.type}` : "";
    const columnList = columns.map((c) => `\`${c}\``).join(", ");

    const sql = `CREATE ${unique} INDEX \`${indexName}\` ON \`${tableName}\` (${columnList}) ${indexType}`;
    await this.execute(sql);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    await this.execute(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const result = await this.query(`SHOW INDEX FROM \`${tableName}\``, []);

    const indexMap = new Map<string, IndexInfo>();
    for (const row of result) {
      const name = row.Key_name;
      if (!indexMap.has(name)) {
        indexMap.set(name, {
          name,
          columns: [],
          unique: row.Non_unique === 0,
          primary: name === "PRIMARY",
          type: row.Index_type,
        });
      }
      indexMap.get(name)!.columns.push(row.Column_name);
    }

    return Array.from(indexMap.values());
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  async select(table: string, options: SelectOptions): Promise<any[]> {
    const columns = options.distinct
      ? `DISTINCT ${options.columns?.join(", ") || "*"}`
      : options.columns?.join(", ") || "*";

    let sql = `SELECT ${columns} FROM \`${table}\``;
    const params: any[] = [];

    // Joins
    if (options.joins && options.joins.length > 0) {
      for (const join of options.joins) {
        const joinType = join.type || "INNER";
        const alias = join.alias ? ` AS \`${join.alias}\`` : "";
        sql += ` ${joinType} JOIN \`${join.table}\`${alias} ON ${join.first} ${join.operator} ${join.second}`;
      }
    }

    // Where clauses
    if (options.where && options.where.length > 0) {
      const whereParts = options.where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    // Group by
    if (options.groupBy && options.groupBy.length > 0) {
      sql += ` GROUP BY ${options.groupBy.map((c) => `\`${c}\``).join(", ")}`;
    }

    // Having
    if (options.having && options.having.length > 0) {
      const havingParts = options.having.map((clause, index) => {
        const boolean = index === 0 ? "HAVING" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + havingParts.join(" ");
    }

    // Order by
    if (options.orderBy && options.orderBy.length > 0) {
      const orderParts = options.orderBy.map(
        (o) => `\`${o.column}\` ${o.direction}`
      );
      sql += ` ORDER BY ${orderParts.join(", ")}`;
    }

    // Limit and offset
    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    // Locking
    if (options.forUpdate) {
      sql += " FOR UPDATE";
      if (options.skipLocked) sql += " SKIP LOCKED";
      if (options.noWait) sql += " NOWAIT";
    } else if (options.forShare) {
      sql += " FOR SHARE";
    }

    return await this.query(sql, params);
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => "?").join(", ");

    const sql = `INSERT INTO \`${table}\` (${keys
      .map((k) => `\`${k}\``)
      .join(", ")}) VALUES (${placeholders})`;
    const result = await this.execute(sql, values);

    return { id: result.insertId, ...data };
  }

  async insertMany(table: string, data: Record<string, any>[]): Promise<any[]> {
    if (data.length === 0) return [];

    const keys = Object.keys(data[0]);
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    for (const row of data) {
      const rowPlaceholders = keys.map(() => "?");
      valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
      values.push(...keys.map((k) => row[k]));
    }

    const sql = `INSERT INTO \`${table}\` (${keys
      .map((k) => `\`${k}\``)
      .join(", ")}) 
                 VALUES ${valuePlaceholders.join(", ")}`;

    const result = await this.execute(sql, values);

    // Return with generated IDs
    return data.map((item, index) => ({
      id: result.insertId + index,
      ...item,
    }));
  }

  async update(
    table: string,
    id: any,
    data: Record<string, any>
  ): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setParts = keys.map((k) => `\`${k}\` = ?`).join(", ");

    const sql = `UPDATE \`${table}\` SET ${setParts} WHERE id = ?`;
    await this.execute(sql, [...values, id]);

    return { id, ...data };
  }

  async updateMany(
    table: string,
    where: WhereClause[],
    data: Record<string, any>
  ): Promise<number> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const params: any[] = [...values];
    const setParts = keys.map((k) => `\`${k}\` = ?`).join(", ");

    let sql = `UPDATE \`${table}\` SET ${setParts}`;

    if (where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    const result = await this.execute(sql, params);
    return result.affectedRows || 0;
  }

  async delete(table: string, id: any): Promise<boolean> {
    const sql = `DELETE FROM \`${table}\` WHERE id = ?`;
    const result = await this.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  async deleteMany(table: string, where: WhereClause[]): Promise<number> {
    const params: any[] = [];

    let sql = `DELETE FROM \`${table}\``;

    if (where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    const result = await this.execute(sql, params);
    return result.affectedRows || 0;
  }

  async upsert(
    table: string,
    data: Record<string, any>,
    uniqueKeys: string[]
  ): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => "?").join(", ");
    const updateParts = keys
      .filter((k) => !uniqueKeys.includes(k))
      .map((k) => `\`${k}\` = VALUES(\`${k}\`)`)
      .join(", ");

    const sql = `INSERT INTO \`${table}\` (${keys
      .map((k) => `\`${k}\``)
      .join(", ")}) 
                 VALUES (${placeholders}) 
                 ON DUPLICATE KEY UPDATE ${updateParts}`;

    const result = await this.execute(sql, values);
    return { id: result.insertId || data.id, ...data };
  }

  // ==========================================================================
  // AGGREGATE OPERATIONS
  // ==========================================================================

  async aggregate(table: string, pipeline: AggregateStage[]): Promise<any[]> {
    // Convert MongoDB-style aggregation pipeline to SQL
    let sql = "";
    const params: any[] = [];

    for (const stage of pipeline) {
      if ("$match" in stage) {
        const match = stage.$match;
        const conditions = Object.entries(match)
          .map(([key, value]) => {
            params.push(value);
            return `\`${key}\` = ?`;
          })
          .join(" AND ");

        if (!sql) {
          sql = `SELECT * FROM \`${table}\` WHERE ${conditions}`;
        }
      }

      if ("$group" in stage) {
        const group = stage.$group;
        const groupBy = group._id;
        const selects: string[] = [];

        if (typeof groupBy === "string") {
          selects.push(`\`${groupBy.replace("$", "")}\` as \`_id\``);
        }

        for (const [key, expr] of Object.entries(group)) {
          if (key === "_id") continue;

          if (typeof expr === "object") {
            if ("$sum" in expr) {
              const field = (expr as any).$sum;
              if (field === 1) {
                selects.push(`COUNT(*) as \`${key}\``);
              } else {
                selects.push(
                  `SUM(\`${field.replace("$", "")}\`) as \`${key}\``
                );
              }
            }
            if ("$avg" in expr) {
              selects.push(
                `AVG(\`${(expr as any).$avg.replace("$", "")}\`) as \`${key}\``
              );
            }
            if ("$min" in expr) {
              selects.push(
                `MIN(\`${(expr as any).$min.replace("$", "")}\`) as \`${key}\``
              );
            }
            if ("$max" in expr) {
              selects.push(
                `MAX(\`${(expr as any).$max.replace("$", "")}\`) as \`${key}\``
              );
            }
          }
        }

        sql = `SELECT ${selects.join(", ")} FROM \`${table}\``;
        if (typeof groupBy === "string") {
          sql += ` GROUP BY \`${groupBy.replace("$", "")}\``;
        }
      }

      if ("$sort" in stage) {
        const sorts = Object.entries(stage.$sort)
          .map(([key, dir]) => `\`${key}\` ${dir === 1 ? "ASC" : "DESC"}`)
          .join(", ");
        sql += ` ORDER BY ${sorts}`;
      }

      if ("$limit" in stage) {
        params.push(stage.$limit);
        sql += ` LIMIT ?`;
      }

      if ("$skip" in stage) {
        params.push(stage.$skip);
        sql += ` OFFSET ?`;
      }
    }

    if (!sql) {
      sql = `SELECT * FROM \`${table}\``;
    }

    return await this.query(sql, params);
  }

  async count(table: string, where?: WhereClause[]): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM \`${table}\``;
    const params: any[] = [];

    if (where && where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    const result = await this.query(sql, params);
    return parseInt(result[0]?.count || "0", 10);
  }

  async distinct(
    table: string,
    column: string,
    where?: WhereClause[]
  ): Promise<any[]> {
    let sql = `SELECT DISTINCT \`${column}\` FROM \`${table}\``;
    const params: any[] = [];

    if (where && where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    const result = await this.query(sql, params);
    return result.map((row: any) => row[column]);
  }

  // ==========================================================================
  // TRANSACTION SUPPORT
  // ==========================================================================

  async beginTransaction(isolationLevel?: IsolationLevel): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");
    this.connection = await this.pool.getConnection();

    if (isolationLevel) {
      await this.connection.query(
        `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
      );
    }

    await this.connection.beginTransaction();
  }

  async commit(): Promise<void> {
    if (!this.connection) throw new Error("No active transaction");
    await this.connection.commit();
    this.connection.release();
    this.connection = null;
  }

  async rollback(): Promise<void> {
    if (!this.connection) throw new Error("No active transaction");
    await this.connection.rollback();
    this.connection.release();
    this.connection = null;
  }

  async transaction<T>(
    callback: (adapter: DatabaseAdapter) => Promise<T>
  ): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await callback(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async raw(query: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error("Database not connected");
    const [result] = await this.pool.execute(query, params);
    return result;
  }

  // ==========================================================================
  // CONNECTION POOL MANAGEMENT
  // ==========================================================================

  getPoolStats(): PoolStats {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0, active: 0 };
    }

    // mysql2 pool doesn't expose these directly, return approximations
    const pool = this.pool as any;
    return {
      total: pool._allConnections?.length || this.config?.pool?.max || 10,
      idle: pool._freeConnections?.length || 0,
      waiting: pool._connectionQueue?.length || 0,
      active:
        (pool._allConnections?.length || 0) -
        (pool._freeConnections?.length || 0),
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private buildWhereCondition(clause: WhereClause, params: any[]): string {
    const column = clause.raw ? clause.column : `\`${clause.column}\``;

    switch (clause.operator) {
      case "IN":
        const inPlaceholders = (clause.value as any[])
          .map(() => "?")
          .join(", ");
        params.push(...clause.value);
        return `${column} IN (${inPlaceholders})`;

      case "NOT IN":
        const notInPlaceholders = (clause.value as any[])
          .map(() => "?")
          .join(", ");
        params.push(...clause.value);
        return `${column} NOT IN (${notInPlaceholders})`;

      case "BETWEEN":
        params.push(clause.value[0], clause.value[1]);
        return `${column} BETWEEN ? AND ?`;

      case "NOT BETWEEN":
        params.push(clause.value[0], clause.value[1]);
        return `${column} NOT BETWEEN ? AND ?`;

      case "IS NULL":
        return `${column} IS NULL`;

      case "IS NOT NULL":
        return `${column} IS NOT NULL`;

      case "LIKE":
        params.push(clause.value);
        return `${column} LIKE ?`;

      case "NOT LIKE":
        params.push(clause.value);
        return `${column} NOT LIKE ?`;

      case "REGEXP":
        params.push(clause.value);
        return `${column} REGEXP ?`;

      case "NOT REGEXP":
        params.push(clause.value);
        return `${column} NOT REGEXP ?`;

      // JSON operators
      case "->":
        params.push(clause.value);
        return `JSON_EXTRACT(${column}, ?)`;

      case "->>":
        params.push(clause.value);
        return `JSON_UNQUOTE(JSON_EXTRACT(${column}, ?))`;

      // Full-text search
      case "MATCH":
        params.push(clause.value);
        return `MATCH(${column}) AGAINST(? IN BOOLEAN MODE)`;

      default:
        params.push(clause.value);
        return `${column} ${clause.operator} ?`;
    }
  }

  private mapType(
    type: string,
    length?: number,
    precision?: number,
    scale?: number
  ): string {
    const typeMap: Record<string, string> = {
      string: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      varchar: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      char: length ? `CHAR(${length})` : "CHAR(1)",
      text: "TEXT",
      mediumtext: "MEDIUMTEXT",
      longtext: "LONGTEXT",
      tinytext: "TINYTEXT",
      integer: "INT",
      int: "INT",
      smallint: "SMALLINT",
      bigint: "BIGINT",
      bigInteger: "BIGINT",
      tinyint: "TINYINT",
      mediumint: "MEDIUMINT",
      float: "FLOAT",
      double: "DOUBLE",
      real: "DOUBLE",
      decimal: precision
        ? `DECIMAL(${precision},${scale || 0})`
        : "DECIMAL(10,2)",
      numeric: precision
        ? `NUMERIC(${precision},${scale || 0})`
        : "NUMERIC(10,2)",
      boolean: "TINYINT(1)",
      bool: "TINYINT(1)",
      date: "DATE",
      datetime: "DATETIME",
      timestamp: "TIMESTAMP",
      time: "TIME",
      year: "YEAR",
      json: "JSON",
      binary: length ? `BINARY(${length})` : "BINARY(255)",
      varbinary: length ? `VARBINARY(${length})` : "VARBINARY(255)",
      blob: "BLOB",
      mediumblob: "MEDIUMBLOB",
      longblob: "LONGBLOB",
      tinyblob: "TINYBLOB",
      uuid: "CHAR(36)",
      point: "POINT",
      linestring: "LINESTRING",
      polygon: "POLYGON",
      geometry: "GEOMETRY",
      enum: "ENUM",
      set: "SET",
    };
    return typeMap[type] || type.toUpperCase();
  }

  private formatValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (value instanceof Date)
      return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
    if (Array.isArray(value)) return `'${JSON.stringify(value)}'`;
    if (typeof value === "object") return `'${JSON.stringify(value)}'`;
    return String(value);
  }
}
