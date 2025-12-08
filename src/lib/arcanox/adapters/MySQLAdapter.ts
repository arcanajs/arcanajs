import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import type {
  ColumnDefinition,
  Connection,
  DatabaseAdapter,
  DatabaseConfig,
  SelectOptions,
  WhereClause,
} from "../types";

/**
 * MySQL Database Adapter
 */
export class MySQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private connection: PoolConnection | null = null;

  async connect(config: DatabaseConfig): Promise<Connection> {
    const mysql = ModuleLoader.require("mysql2/promise");

    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: config.pool?.max || 10,
      queueLimit: 0,
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
    const executor = this.connection || this.pool;
    if (!executor) throw new Error("Database not connected");
    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows;
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const executor = this.connection || this.pool;
    if (!executor) throw new Error("Database not connected");
    const [result] = await executor.execute<ResultSetHeader>(sql, params);
    return result;
  }

  async createTable(
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    const columnDefs = columns
      .map((col) => {
        let def = `\`${col.name}\` ${this.mapType(col.type, col.length)}`;

        if (col.unsigned) def += " UNSIGNED";
        if (col.autoIncrement) def += " AUTO_INCREMENT";
        if (!col.nullable) def += " NOT NULL";
        if (col.default !== undefined) {
          def += ` DEFAULT ${this.formatValue(col.default)}`;
        }
        if (col.primary) def += " PRIMARY KEY";
        if (col.unique) def += " UNIQUE";

        return def;
      })
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
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

  async select(table: string, options: SelectOptions): Promise<any[]> {
    const columns = options.columns?.join(", ") || "*";
    let sql = `SELECT ${columns} FROM \`${table}\``;
    const params: any[] = [];

    // Joins
    if (options.joins && options.joins.length > 0) {
      for (const join of options.joins) {
        sql += ` ${join.type} JOIN \`${join.table}\` ON ${join.first} ${join.operator} ${join.second}`;
      }
    }

    // Where clauses
    if (options.where && options.where.length > 0) {
      const whereParts = options.where.map((clause, index) => {
        const boolean = index === 0 ? "WHERE" : clause.boolean;
        const condition = this.buildWhereCondition(clause, params);
        return `${boolean} ${condition}`;
      });
      sql += " " + whereParts.join(" ");
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

  async delete(table: string, id: any): Promise<boolean> {
    const sql = `DELETE FROM \`${table}\` WHERE id = ?`;
    const result = await this.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");
    this.connection = await this.pool.getConnection();
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

  async raw(query: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error("Database not connected");
    const [result] = await this.pool.execute(query, params);
    return result;
  }

  private buildWhereCondition(clause: WhereClause, params: any[]): string {
    const column = `\`${clause.column}\``;

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

      case "IS NULL":
        return `${column} IS NULL`;

      case "IS NOT NULL":
        return `${column} IS NOT NULL`;

      default:
        params.push(clause.value);
        return `${column} ${clause.operator} ?`;
    }
  }

  private mapType(type: string, length?: number): string {
    const typeMap: Record<string, string> = {
      string: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "TEXT",
      integer: "INT",
      bigInteger: "BIGINT",
      float: "FLOAT",
      double: "DOUBLE",
      decimal: "DECIMAL(10,2)",
      boolean: "TINYINT(1)",
      date: "DATE",
      datetime: "DATETIME",
      timestamp: "TIMESTAMP",
      json: "JSON",
      uuid: "CHAR(36)",
    };
    return typeMap[type] || type.toUpperCase();
  }

  private formatValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (value instanceof Date)
      return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
    return String(value);
  }
}
