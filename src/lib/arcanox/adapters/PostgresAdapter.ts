import type { Pool, PoolClient, QueryResult } from "pg";
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
 * PostgreSQL Database Adapter
 * Professional PostgreSQL adapter with advanced features, transactions, and connection pooling
 *
 * Arcanox ORM - PostgreSQL Adapter
 */
export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private client: PoolClient | null = null;
  private config: DatabaseConfig | null = null;
  private queryLog: Array<{ query: string; params?: any[]; duration: number }> =
    [];

  /**
   * Connect to PostgreSQL database
   */
  async connect(config: DatabaseConfig): Promise<Connection> {
    const { Pool } = ModuleLoader.require("pg");
    this.config = config;

    const poolConfig: any = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      min: config.pool?.min || 2,
      max: config.pool?.max || 10,
      idleTimeoutMillis: config.pool?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectTimeout || 10000,
      application_name: config.applicationName || "arcanajs",
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

    // Statement timeout
    if (config.statementTimeout) {
      poolConfig.statement_timeout = config.statementTimeout;
    }

    // Query timeout
    if (config.queryTimeout) {
      poolConfig.query_timeout = config.queryTimeout;
    }

    this.pool = new Pool(poolConfig);

    // Connection event handlers
    if (this.pool) {
      this.pool.on("connect", () => {
        if (config.events?.onConnect) {
          config.events.onConnect();
        }
      });

      this.pool.on("error", (err) => {
        if (config.events?.onError) {
          config.events.onError(err);
        }
      });
    }

    // Log connection if enabled
    if (
      config.logging &&
      typeof config.logging === "object" &&
      config.logging.connections
    ) {
      console.log(`[Arcanox PostgreSQL] Connected to ${config.database}`);
    }

    return {
      query: this.query.bind(this),
      execute: this.execute.bind(this),
      close: this.disconnect.bind(this),
    };
  }

  /**
   * Disconnect from PostgreSQL
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
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
    const executor = this.client || this.pool;
    if (!executor) throw new Error("Database not connected");

    const startTime = Date.now();
    const result: QueryResult = await executor.query(sql, params);
    const duration = Date.now() - startTime;

    this.logQuery(sql, params, duration);

    return result.rows;
  }

  /**
   * Execute a query and return full result
   */
  async execute(sql: string, params?: any[]): Promise<any> {
    const executor = this.client || this.pool;
    if (!executor) throw new Error("Database not connected");

    const startTime = Date.now();
    const result: QueryResult = await executor.query(sql, params);
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
        console.log(
          `[Arcanox PostgreSQL] ${sql}`,
          params || [],
          `(${duration}ms)`
        );
      }

      if (
        logging.slowQueries &&
        this.config.slowQueryThreshold &&
        duration > this.config.slowQueryThreshold
      ) {
        console.warn(
          `[Arcanox PostgreSQL] Slow query (${duration}ms): ${sql}`,
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
        let def = `"${col.name}" ${this.mapType(
          col.type,
          col.length,
          col.precision,
          col.scale
        )}`;

        if (col.primary) def += " PRIMARY KEY";
        if (col.autoIncrement) def = `"${col.name}" SERIAL PRIMARY KEY`;
        if (String(col.type) === "bigInteger" && col.autoIncrement)
          def = `"${col.name}" BIGSERIAL PRIMARY KEY`;
        if (!col.nullable && !col.autoIncrement) def += " NOT NULL";
        if (col.unique && !col.primary) def += " UNIQUE";
        if (col.default !== undefined) {
          def += ` DEFAULT ${this.formatValue(col.default)}`;
        }
        if (col.check) {
          def += ` CHECK (${col.check})`;
        }

        return def;
      })
      .join(", ");

    const schema = this.config?.schema || "public";
    const sql = `CREATE TABLE IF NOT EXISTS "${schema}"."${tableName}" (${columnDefs})`;
    await this.execute(sql);
  }

  async dropTable(tableName: string): Promise<void> {
    const schema = this.config?.schema || "public";
    await this.execute(
      `DROP TABLE IF EXISTS "${schema}"."${tableName}" CASCADE`
    );
  }

  async hasTable(tableName: string): Promise<boolean> {
    const schema = this.config?.schema || "public";
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      )`,
      [schema, tableName]
    );
    return result[0]?.exists || false;
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const schema = this.config?.schema || "public";
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = $1 
        AND table_name = $2 
        AND column_name = $3
      )`,
      [schema, tableName, columnName]
    );
    return result[0]?.exists || false;
  }

  async renameTable(from: string, to: string): Promise<void> {
    const schema = this.config?.schema || "public";
    await this.execute(`ALTER TABLE "${schema}"."${from}" RENAME TO "${to}"`);
  }

  async addColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    const schema = this.config?.schema || "public";
    let def = `"${column.name}" ${this.mapType(
      column.type,
      column.length,
      column.precision,
      column.scale
    )}`;

    if (!column.nullable) def += " NOT NULL";
    if (column.unique) def += " UNIQUE";
    if (column.default !== undefined) {
      def += ` DEFAULT ${this.formatValue(column.default)}`;
    }

    await this.execute(
      `ALTER TABLE "${schema}"."${tableName}" ADD COLUMN ${def}`
    );
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    const schema = this.config?.schema || "public";
    await this.execute(
      `ALTER TABLE "${schema}"."${tableName}" DROP COLUMN "${columnName}"`
    );
  }

  async renameColumn(
    tableName: string,
    from: string,
    to: string
  ): Promise<void> {
    const schema = this.config?.schema || "public";
    await this.execute(
      `ALTER TABLE "${schema}"."${tableName}" RENAME COLUMN "${from}" TO "${to}"`
    );
  }

  async modifyColumn(
    tableName: string,
    column: ColumnDefinition
  ): Promise<void> {
    const schema = this.config?.schema || "public";
    const type = this.mapType(
      column.type,
      column.length,
      column.precision,
      column.scale
    );

    await this.execute(
      `ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${column.name}" TYPE ${type}`
    );

    if (column.nullable !== undefined) {
      const nullAction = column.nullable ? "DROP NOT NULL" : "SET NOT NULL";
      await this.execute(
        `ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${column.name}" ${nullAction}`
      );
    }

    if (column.default !== undefined) {
      await this.execute(
        `ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${
          column.name
        }" SET DEFAULT ${this.formatValue(column.default)}`
      );
    }
  }

  // ==========================================================================
  // INDEX OPERATIONS
  // ==========================================================================

  async createIndex(
    tableName: string,
    columns: string[],
    options?: IndexOptions
  ): Promise<void> {
    const schema = this.config?.schema || "public";
    const indexName = options?.name || `idx_${tableName}_${columns.join("_")}`;
    const unique = options?.unique ? "UNIQUE" : "";
    const indexType = options?.type ? `USING ${options.type}` : "";
    const columnList = columns.map((c) => `"${c}"`).join(", ");

    let sql = `CREATE ${unique} INDEX IF NOT EXISTS "${indexName}" ON "${schema}"."${tableName}" ${indexType} (${columnList})`;

    if (options?.includes && options.includes.length > 0) {
      sql += ` INCLUDE (${options.includes.map((c) => `"${c}"`).join(", ")})`;
    }

    if (options?.where) {
      sql += ` WHERE ${options.where}`;
    }

    await this.execute(sql);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    const schema = this.config?.schema || "public";
    await this.execute(`DROP INDEX IF EXISTS "${schema}"."${indexName}"`);
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const schema = this.config?.schema || "public";
    const result = await this.query(
      `
      SELECT
        i.relname as name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        am.amname as type
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      WHERE t.relname = $1 AND n.nspname = $2
      ORDER BY i.relname, a.attnum
    `,
      [tableName, schema]
    );

    const indexMap = new Map<string, IndexInfo>();
    for (const row of result) {
      if (!indexMap.has(row.name)) {
        indexMap.set(row.name, {
          name: row.name,
          columns: [],
          unique: row.is_unique,
          primary: row.is_primary,
          type: row.type,
        });
      }
      indexMap.get(row.name)!.columns.push(row.column_name);
    }

    return Array.from(indexMap.values());
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  async select(table: string, options: SelectOptions): Promise<any[]> {
    const schema = this.config?.schema || "public";
    const columns = options.distinct
      ? `DISTINCT ${options.columns?.join(", ") || "*"}`
      : options.columns?.join(", ") || "*";

    let sql = `SELECT ${columns} FROM "${schema}"."${table}"`;
    const params: any[] = [];
    let paramIndex = 1;

    // Joins
    if (options.joins && options.joins.length > 0) {
      for (const join of options.joins) {
        const joinType = join.type || "INNER";
        const alias = join.alias ? ` AS "${join.alias}"` : "";
        sql += ` ${joinType} JOIN "${schema}"."${join.table}"${alias} ON ${join.first} ${join.operator} ${join.second}`;
      }
    }

    // Where clauses
    if (options.where && options.where.length > 0) {
      const whereParts = options.where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    // Group by
    if (options.groupBy && options.groupBy.length > 0) {
      sql += ` GROUP BY ${options.groupBy.map((c) => `"${c}"`).join(", ")}`;
    }

    // Having
    if (options.having && options.having.length > 0) {
      const havingParts = options.having.map((clause, index) => {
        const boolean = index === 0 ? "HAVING" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
        return `${boolean} ${condition}`;
      });
      sql += " " + havingParts.join(" ");
    }

    // Order by
    if (options.orderBy && options.orderBy.length > 0) {
      const orderParts = options.orderBy.map((o) => {
        let orderSql = `"${o.column}" ${o.direction}`;
        if (o.nulls) orderSql += ` NULLS ${o.nulls}`;
        return orderSql;
      });
      sql += ` ORDER BY ${orderParts.join(", ")}`;
    }

    // Limit and offset
    if (options.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${paramIndex++}`;
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
    const schema = this.config?.schema || "public";
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

    const sql = `INSERT INTO "${schema}"."${table}" (${keys
      .map((k) => `"${k}"`)
      .join(", ")}) 
                 VALUES (${placeholders}) 
                 RETURNING *`;

    const result = await this.query(sql, values);
    return result[0];
  }

  async insertMany(table: string, data: Record<string, any>[]): Promise<any[]> {
    if (data.length === 0) return [];

    const schema = this.config?.schema || "public";
    const keys = Object.keys(data[0]);
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    let paramIndex = 1;
    for (const row of data) {
      const rowPlaceholders = keys.map(() => `$${paramIndex++}`);
      valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
      values.push(...keys.map((k) => row[k]));
    }

    const sql = `INSERT INTO "${schema}"."${table}" (${keys
      .map((k) => `"${k}"`)
      .join(", ")}) 
                 VALUES ${valuePlaceholders.join(", ")} 
                 RETURNING *`;

    return await this.query(sql, values);
  }

  async update(
    table: string,
    id: any,
    data: Record<string, any>
  ): Promise<any> {
    const schema = this.config?.schema || "public";
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setParts = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");

    const sql = `UPDATE "${schema}"."${table}" SET ${setParts} WHERE id = $${
      keys.length + 1
    } RETURNING *`;
    const result = await this.query(sql, [...values, id]);
    return result[0];
  }

  async updateMany(
    table: string,
    where: WhereClause[],
    data: Record<string, any>
  ): Promise<number> {
    const schema = this.config?.schema || "public";
    const keys = Object.keys(data);
    const values = Object.values(data);
    const params: any[] = [...values];

    let paramIndex = keys.length + 1;
    const setParts = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");

    let sql = `UPDATE "${schema}"."${table}" SET ${setParts}`;

    if (where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    const result = await this.execute(sql, params);
    return result.rowCount || 0;
  }

  async delete(table: string, id: any): Promise<boolean> {
    const schema = this.config?.schema || "public";
    const sql = `DELETE FROM "${schema}"."${table}" WHERE id = $1`;
    const result = await this.execute(sql, [id]);
    return (result.rowCount || 0) > 0;
  }

  async deleteMany(table: string, where: WhereClause[]): Promise<number> {
    const schema = this.config?.schema || "public";
    const params: any[] = [];
    let paramIndex = 1;

    let sql = `DELETE FROM "${schema}"."${table}"`;

    if (where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    const result = await this.execute(sql, params);
    return result.rowCount || 0;
  }

  async upsert(
    table: string,
    data: Record<string, any>,
    uniqueKeys: string[]
  ): Promise<any> {
    const schema = this.config?.schema || "public";
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const conflictColumns = uniqueKeys.map((k) => `"${k}"`).join(", ");
    const updateParts = keys
      .filter((k) => !uniqueKeys.includes(k))
      .map((k) => `"${k}" = EXCLUDED."${k}"`)
      .join(", ");

    const sql = `INSERT INTO "${schema}"."${table}" (${keys
      .map((k) => `"${k}"`)
      .join(", ")}) 
                 VALUES (${placeholders}) 
                 ON CONFLICT (${conflictColumns}) 
                 DO UPDATE SET ${updateParts}
                 RETURNING *`;

    const result = await this.query(sql, values);
    return result[0];
  }

  // ==========================================================================
  // AGGREGATE OPERATIONS
  // ==========================================================================

  async aggregate(table: string, pipeline: AggregateStage[]): Promise<any[]> {
    // Convert MongoDB-style aggregation pipeline to SQL
    const schema = this.config?.schema || "public";
    let sql = "";
    const params: any[] = [];
    let paramIndex = 1;

    // This is a simplified implementation - complex aggregations may need custom SQL
    for (const stage of pipeline) {
      if ("$match" in stage) {
        const match = stage.$match;
        const conditions = Object.entries(match)
          .map(([key, value]) => {
            params.push(value);
            return `"${key}" = $${paramIndex++}`;
          })
          .join(" AND ");

        if (!sql) {
          sql = `SELECT * FROM "${schema}"."${table}" WHERE ${conditions}`;
        }
      }

      if ("$group" in stage) {
        const group = stage.$group;
        const groupBy = group._id;
        const selects: string[] = [];

        if (typeof groupBy === "string") {
          selects.push(`"${groupBy.replace("$", "")}" as "_id"`);
        }

        for (const [key, expr] of Object.entries(group)) {
          if (key === "_id") continue;

          if (typeof expr === "object") {
            if ("$sum" in expr) {
              const field = (expr as any).$sum;
              if (field === 1) {
                selects.push(`COUNT(*) as "${key}"`);
              } else {
                selects.push(`SUM("${field.replace("$", "")}") as "${key}"`);
              }
            }
            if ("$avg" in expr) {
              selects.push(
                `AVG("${(expr as any).$avg.replace("$", "")}") as "${key}"`
              );
            }
            if ("$min" in expr) {
              selects.push(
                `MIN("${(expr as any).$min.replace("$", "")}") as "${key}"`
              );
            }
            if ("$max" in expr) {
              selects.push(
                `MAX("${(expr as any).$max.replace("$", "")}") as "${key}"`
              );
            }
          }
        }

        sql = `SELECT ${selects.join(", ")} FROM "${schema}"."${table}"`;
        if (typeof groupBy === "string") {
          sql += ` GROUP BY "${groupBy.replace("$", "")}"`;
        }
      }

      if ("$sort" in stage) {
        const sorts = Object.entries(stage.$sort)
          .map(([key, dir]) => `"${key}" ${dir === 1 ? "ASC" : "DESC"}`)
          .join(", ");
        sql += ` ORDER BY ${sorts}`;
      }

      if ("$limit" in stage) {
        params.push(stage.$limit);
        sql += ` LIMIT $${paramIndex++}`;
      }

      if ("$skip" in stage) {
        params.push(stage.$skip);
        sql += ` OFFSET $${paramIndex++}`;
      }
    }

    if (!sql) {
      sql = `SELECT * FROM "${schema}"."${table}"`;
    }

    return await this.query(sql, params);
  }

  async count(table: string, where?: WhereClause[]): Promise<number> {
    const schema = this.config?.schema || "public";
    let sql = `SELECT COUNT(*) as count FROM "${schema}"."${table}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (where && where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
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
    const schema = this.config?.schema || "public";
    let sql = `SELECT DISTINCT "${column}" FROM "${schema}"."${table}"`;
    const params: any[] = [];
    let paramIndex = 1;

    if (where && where.length > 0) {
      const whereParts = where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean || "AND";
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
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
    this.client = await this.pool.connect();

    let sql = "BEGIN";
    if (isolationLevel) {
      sql += ` ISOLATION LEVEL ${isolationLevel}`;
    }

    await this.client.query(sql);
  }

  async commit(): Promise<void> {
    if (!this.client) throw new Error("No active transaction");
    await this.client.query("COMMIT");
    this.client.release();
    this.client = null;
  }

  async rollback(): Promise<void> {
    if (!this.client) throw new Error("No active transaction");
    await this.client.query("ROLLBACK");
    this.client.release();
    this.client = null;
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
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // ==========================================================================
  // CONNECTION POOL MANAGEMENT
  // ==========================================================================

  getPoolStats(): PoolStats {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0, active: 0 };
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      active: this.pool.totalCount - this.pool.idleCount,
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

  private buildWhereCondition(
    clause: WhereClause,
    params: any[],
    startIndex: number
  ): string {
    const column = clause.raw ? clause.column : `"${clause.column}"`;

    switch (clause.operator) {
      case "IN":
        const inPlaceholders = (clause.value as any[])
          .map((_, i) => `$${startIndex + i}`)
          .join(", ");
        params.push(...clause.value);
        return `${column} IN (${inPlaceholders})`;

      case "NOT IN":
        const notInPlaceholders = (clause.value as any[])
          .map((_, i) => `$${startIndex + i}`)
          .join(", ");
        params.push(...clause.value);
        return `${column} NOT IN (${notInPlaceholders})`;

      case "BETWEEN":
        params.push(clause.value[0], clause.value[1]);
        return `${column} BETWEEN $${startIndex} AND $${startIndex + 1}`;

      case "NOT BETWEEN":
        params.push(clause.value[0], clause.value[1]);
        return `${column} NOT BETWEEN $${startIndex} AND $${startIndex + 1}`;

      case "IS NULL":
        return `${column} IS NULL`;

      case "IS NOT NULL":
        return `${column} IS NOT NULL`;

      case "LIKE":
        params.push(clause.value);
        return `${column} LIKE $${startIndex}`;

      case "NOT LIKE":
        params.push(clause.value);
        return `${column} NOT LIKE $${startIndex}`;

      case "ILIKE":
        params.push(clause.value);
        return `${column} ILIKE $${startIndex}`;

      case "NOT ILIKE":
        params.push(clause.value);
        return `${column} NOT ILIKE $${startIndex}`;

      case "SIMILAR TO":
        params.push(clause.value);
        return `${column} SIMILAR TO $${startIndex}`;

      case "REGEXP":
        params.push(clause.value);
        return `${column} ~ $${startIndex}`;

      case "NOT REGEXP":
        params.push(clause.value);
        return `${column} !~ $${startIndex}`;

      // Array operators
      case "@>":
        params.push(clause.value);
        return `${column} @> $${startIndex}`;

      case "<@":
        params.push(clause.value);
        return `${column} <@ $${startIndex}`;

      case "&&":
        params.push(clause.value);
        return `${column} && $${startIndex}`;

      // JSON operators
      case "->":
      case "->>":
      case "#>":
      case "#>>":
      case "?":
      case "?|":
      case "?&":
      case "@?":
        params.push(clause.value);
        return `${column} ${clause.operator} $${startIndex}`;

      // Full-text search
      case "@@":
        params.push(clause.value);
        return `${column} @@ to_tsquery($${startIndex})`;

      default:
        params.push(clause.value);
        return `${column} ${clause.operator} $${startIndex}`;
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
      mediumtext: "TEXT",
      longtext: "TEXT",
      tinytext: "TEXT",
      integer: "INTEGER",
      int: "INTEGER",
      smallint: "SMALLINT",
      bigint: "BIGINT",
      bigInteger: "BIGINT",
      tinyint: "SMALLINT",
      mediumint: "INTEGER",
      float: "REAL",
      double: "DOUBLE PRECISION",
      real: "REAL",
      decimal: precision
        ? `DECIMAL(${precision},${scale || 0})`
        : "DECIMAL(10,2)",
      numeric: precision
        ? `NUMERIC(${precision},${scale || 0})`
        : "NUMERIC(10,2)",
      boolean: "BOOLEAN",
      bool: "BOOLEAN",
      date: "DATE",
      datetime: "TIMESTAMP",
      timestamp: "TIMESTAMP WITH TIME ZONE",
      time: "TIME",
      year: "INTEGER",
      json: "JSONB",
      jsonb: "JSONB",
      uuid: "UUID",
      binary: "BYTEA",
      blob: "BYTEA",
      inet: "INET",
      cidr: "CIDR",
      macaddr: "MACADDR",
      money: "MONEY",
      point: "POINT",
      line: "LINE",
      polygon: "POLYGON",
      geometry: "GEOMETRY",
      tsvector: "TSVECTOR",
      tsquery: "TSQUERY",
      interval: "INTERVAL",
    };
    return typeMap[type] || type.toUpperCase();
  }

  private formatValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (Array.isArray(value))
      return `ARRAY[${value.map((v) => this.formatValue(v)).join(",")}]`;
    if (typeof value === "object") return `'${JSON.stringify(value)}'::jsonb`;
    return String(value);
  }
}
