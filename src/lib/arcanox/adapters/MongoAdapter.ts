import type { Db, MongoClient } from "mongodb";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import {
  ColumnDefinition,
  Connection,
  DatabaseAdapter,
  DatabaseConfig,
  SelectOptions,
  WhereClause,
} from "../types";

export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(config: DatabaseConfig): Promise<Connection> {
    const { MongoClient } = ModuleLoader.require("mongodb");

    // Support full connection string (url or uri) or build from parts
    const url =
      config.url || config.uri || `mongodb://${config.host}:${config.port}`;

    const options: any = {
      family: 4, // Force IPv4 to avoid connection issues with MongoDB Atlas
    };

    if (config.pool) {
      options.minPoolSize = config.pool.min;
      options.maxPoolSize = config.pool.max;
    }

    if (config.ssl !== undefined) {
      options.tls = config.ssl;
    }

    // Only add auth if not using a connection string that likely already has it
    // or if explicitly provided to override
    if (!config.url && !config.uri && config.username && config.password) {
      options.auth = {
        username: config.username,
        password: config.password,
      };
    }

    this.client = new MongoClient(url, options);

    try {
      await this.client!.connect();
    } catch (error: any) {
      if (
        error.name === "MongoServerSelectionError" ||
        error.message.includes("SSL") ||
        error.message.includes("ECONNREFUSED")
      ) {
        console.error(
          "\n\x1b[31m%s\x1b[0m", // Red color
          "MongoDB Connection Failed: It looks like you are unable to connect to the database."
        );
        console.error(
          "\x1b[33m%s\x1b[0m", // Yellow color
          "Hint: If you are using MongoDB Atlas, please ensure your current IP address is whitelisted in the Network Access settings."
        );
        console.error(
          "\x1b[33m%s\x1b[0m\n",
          " If it doesn't work, it may mean that your wifi connection or your router is blocking the connection to Mongo Atlas, You can allow access from anywhere (0.0.0.0/0) for development purposes, or add your specific IP."
        );
      }
      throw error;
    }

    this.db = this.client!.db(config.database);

    return {
      query: async (sql: string, params?: any[]) => {
        throw new Error("Raw SQL queries are not supported in MongoDB adapter");
      },
      execute: async (sql: string, params?: any[]) => {
        throw new Error(
          "Raw SQL execution is not supported in MongoDB adapter"
        );
      },
      close: async () => {
        await this.disconnect();
      },
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  // Schema operations
  async createTable(
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    // MongoDB creates collections automatically, but we can create it explicitly
    // to apply validation rules if needed (not implemented here for simplicity)
    await this.db.createCollection(tableName);
  }

  async dropTable(tableName: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await this.db.collection(tableName).drop();
  }

  async hasTable(tableName: string): Promise<boolean> {
    if (!this.db) throw new Error("Database not connected");
    const collections = await this.db
      .listCollections({ name: tableName })
      .toArray();
    return collections.length > 0;
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    // MongoDB is schemaless, so this is always true effectively,
    // or we could check if any document has this field.
    return true;
  }

  // Query operations
  async select(table: string, options: SelectOptions): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");

    const collection = this.db.collection(table);
    const filter = this.buildFilter(options.where || []);
    const projection = this.buildProjection(options.columns);

    let cursor = collection.find(filter);

    if (projection) {
      cursor = cursor.project(projection);
    }

    if (options.orderBy) {
      const sort: any = {};
      options.orderBy.forEach((order) => {
        sort[order.column] = order.direction === "ASC" ? 1 : -1;
      });
      cursor = cursor.sort(sort);
    }

    if (options.offset) {
      cursor = cursor.skip(options.offset);
    }

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    const results = await cursor.toArray();

    // Map _id to id but keep _id
    return results.map((doc) => {
      const { _id, ...rest } = doc;
      return { id: _id, _id, ...rest };
    });
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    // Remove id if present and let Mongo generate _id, or map id to _id
    const doc = { ...data };
    if (doc.id) {
      doc._id = doc.id;
      delete doc.id;
    }

    const result = await collection.insertOne(doc);

    return {
      id: result.insertedId,
      _id: result.insertedId,
      ...data,
    };
  }

  async update(
    table: string,
    id: any,
    data: Record<string, any>
  ): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    const filter = { _id: this.normalizeId(id) };
    const update = { $set: data };

    const result = await collection.findOneAndUpdate(filter, update, {
      returnDocument: "after",
    });

    if (result) {
      const { _id, ...rest } = result;
      return { id: _id, _id, ...rest };
    }
    return null;
  }

  async delete(table: string, id: any): Promise<boolean> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);
    const result = await collection.deleteOne({ _id: this.normalizeId(id) });
    return result.deletedCount === 1;
  }

  // Transaction support
  async beginTransaction(): Promise<void> {
    // MongoDB transactions require replica set
    // Placeholder implementation
  }

  async raw(query: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    // For MongoDB, raw query might interpret the string as a command
    // or return the raw db object for advanced usage if query is "db"
    if (query === "db") return this.db;

    // Simple command execution
    return await this.db.command(JSON.parse(query));
  }

  async commit(): Promise<void> {
    //
  }

  async rollback(): Promise<void> {
    //
  }

  // Helpers
  private buildFilter(where: WhereClause[]): any {
    const filter: any = {};

    where.forEach((clause) => {
      const column = clause.column === "id" ? "_id" : clause.column;
      let value = clause.value;

      if (column === "_id") {
        value = this.normalizeId(value);
      }

      switch (clause.operator) {
        case "=":
          filter[column] = value;
          break;
        case "!=":
          filter[column] = { $ne: value };
          break;
        case ">":
          filter[column] = { $gt: value };
          break;
        case "<":
          filter[column] = { $lt: value };
          break;
        case ">=":
          filter[column] = { $gte: value };
          break;
        case "<=":
          filter[column] = { $lte: value };
          break;
        case "IN":
          filter[column] = { $in: Array.isArray(value) ? value : [value] };
          break;
        case "NOT IN":
          filter[column] = { $nin: Array.isArray(value) ? value : [value] };
          break;
        case "LIKE":
          // Simple regex for LIKE
          filter[column] = {
            $regex: new RegExp(value.replace(/%/g, ".*"), "i"),
          };
          break;
        case "IS NULL":
          filter[column] = null;
          break;
        case "IS NOT NULL":
          filter[column] = { $ne: null };
          break;
      }
    });

    return filter;
  }

  private buildProjection(columns?: string[]): any {
    if (!columns || columns.length === 0 || columns.includes("*")) {
      return null;
    }
    const projection: any = {};
    columns.forEach((col) => {
      if (col === "id") {
        // _id is included by default, no need to project it explicitly unless we want to exclude others
        // But if we select specific columns, we need to ensure _id is handled
      } else {
        projection[col] = 1;
      }
    });
    return projection;
  }

  private normalizeId(id: any): any {
    const { ObjectId } = ModuleLoader.require("mongodb");
    if (id instanceof ObjectId) return id;
    if (typeof id === "string" && ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    return id;
  }
}
