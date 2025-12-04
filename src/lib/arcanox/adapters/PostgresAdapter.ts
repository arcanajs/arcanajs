import type { Pool, PoolClient, QueryResult } from "pg";
import { dynamicRequireSync } from "../../server/utils/dynamicRequire";
import type {
  ColumnDefinition,
  Connection,
  DatabaseAdapter,
  DatabaseConfig,
  SelectOptions,
  WhereClause,
} from "../types";

/**
 * PostgreSQL Database Adapter
 */
export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private client: PoolClient | null = null;

  async connect(config: DatabaseConfig): Promise<Connection> {
    const { Pool } = dynamicRequireSync("pg");

    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      min: config.pool?.min || 2,
      max: config.pool?.max || 10,
    });

    return {
      query: this.query.bind(this),
      execute: this.execute.bind(this),
      close: this.disconnect.bind(this),
    };
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Database not connected");
    const result: QueryResult = await this.pool.query(sql, params);
    return result.rows;
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Database not connected");
    const result: QueryResult = await this.pool.query(sql, params);
    return result;
  }

  async createTable(
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    const columnDefs = columns
      .map((col) => {
        let def = `"${col.name}" ${this.mapType(col.type, col.length)}`;

        if (col.primary) def += " PRIMARY KEY";
        if (col.autoIncrement) def += " GENERATED ALWAYS AS IDENTITY";
        if (!col.nullable) def += " NOT NULL";
        if (col.unique) def += " UNIQUE";
        if (col.default !== undefined) {
          def += ` DEFAULT ${this.formatValue(col.default)}`;
        }

        return def;
      })
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs})`;
    await this.execute(sql);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.execute(`DROP TABLE IF EXISTS "${tableName}"`);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result[0]?.exists || false;
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      )`,
      [tableName, columnName]
    );
    return result[0]?.exists || false;
  }

  async select(table: string, options: SelectOptions): Promise<any[]> {
    const columns = options.columns?.join(", ") || "*";
    let sql = `SELECT ${columns} FROM "${table}"`;
    const params: any[] = [];
    let paramIndex = 1;

    // Joins
    if (options.joins && options.joins.length > 0) {
      for (const join of options.joins) {
        sql += ` ${join.type} JOIN "${join.table}" ON ${join.first} ${join.operator} ${join.second}`;
      }
    }

    // Where clauses
    if (options.where && options.where.length > 0) {
      const whereParts = options.where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean;
        const condition = this.buildWhereCondition(clause, params, paramIndex);
        paramIndex = params.length + 1;
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
    }

    // Order by
    if (options.orderBy && options.orderBy.length > 0) {
      const orderParts = options.orderBy.map(
        (o) => `"${o.column}" ${o.direction}`
      );
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

    return await this.query(sql, params);
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

    const sql = `INSERT INTO "${table}" (${keys
      .map((k) => `"${k}"`)
      .join(", ")}) 
                 VALUES (${placeholders}) 
                 RETURNING *`;

    const result = await this.query(sql, values);
    return result[0];
  }

  async update(
    table: string,
    id: any,
    data: Record<string, any>
  ): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setParts = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");

    const sql = `UPDATE "${table}" SET ${setParts} WHERE id = $${
      keys.length + 1
    } RETURNING *`;
    const result = await this.query(sql, [...values, id]);
    return result[0];
  }

  async delete(table: string, id: any): Promise<boolean> {
    const sql = `DELETE FROM "${table}" WHERE id = $1`;
    const result = await this.execute(sql, [id]);
    return result.rowCount > 0;
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");
    this.client = await this.pool.connect();
    await this.client.query("BEGIN");
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

  async raw(query: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error("Database not connected");
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  private buildWhereCondition(
    clause: WhereClause,
    params: any[],
    startIndex: number
  ): string {
    const column = `"${clause.column}"`;

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

      case "IS NULL":
        return `${column} IS NULL`;

      case "IS NOT NULL":
        return `${column} IS NOT NULL`;

      default:
        params.push(clause.value);
        return `${column} ${clause.operator} $${startIndex}`;
    }
  }

  private mapType(type: string, length?: number): string {
    const typeMap: Record<string, string> = {
      string: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "TEXT",
      integer: "INTEGER",
      bigInteger: "BIGINT",
      float: "REAL",
      double: "DOUBLE PRECISION",
      decimal: "DECIMAL",
      boolean: "BOOLEAN",
      date: "DATE",
      datetime: "TIMESTAMP",
      timestamp: "TIMESTAMP",
      json: "JSONB",
      uuid: "UUID",
    };
    return typeMap[type] || type.toUpperCase();
  }

  private formatValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return String(value);
  }
}
