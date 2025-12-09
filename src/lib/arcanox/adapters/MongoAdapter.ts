import type {
  ClientSession,
  Collection,
  Db,
  Document,
  MongoClient,
} from "mongodb";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import {
  AggregateStage,
  ColumnDefinition,
  Connection,
  DatabaseAdapter,
  DatabaseConfig,
  IndexInfo,
  IndexOptions,
  PoolStats,
  SelectOptions,
  WhereClause,
} from "../types";

/**
 * MongoDB Database Adapter
 * Professional MongoDB adapter with aggregation pipeline, transactions, and advanced features
 *
 * Arcanox ODM - MongoDB Adapter
 */
export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private session: ClientSession | null = null;
  private config: DatabaseConfig | null = null;

  /**
   * Connect to MongoDB database
   */
  async connect(config: DatabaseConfig): Promise<Connection> {
    const { MongoClient } = ModuleLoader.require("mongodb");
    this.config = config;

    // Build connection URL
    const url = this.buildConnectionUrl(config);

    // Build connection options
    const options: any = {
      family: 4,
      ...this.buildConnectionOptions(config),
    };

    this.client = new MongoClient(url, options);

    try {
      await this.client!.connect();

      // Log connection if enabled
      if (config.events?.onConnect) {
        config.events.onConnect();
      }

      if (
        config.logging &&
        typeof config.logging === "object" &&
        config.logging.connections
      ) {
        console.log(`[Arcanox MongoDB] Connected to ${config.database}`);
      }
    } catch (error: any) {
      this.handleConnectionError(error);
      throw error;
    }

    this.db = this.client!.db(config.database);

    return {
      query: async (sql: string, params?: any[]) => {
        throw new Error(
          "Raw SQL queries are not supported in MongoDB adapter. Use aggregate() or collection methods."
        );
      },
      execute: async (sql: string, params?: any[]) => {
        throw new Error(
          "Raw SQL execution is not supported in MongoDB adapter. Use aggregate() or collection methods."
        );
      },
      close: async () => {
        await this.disconnect();
      },
    };
  }

  /**
   * Build MongoDB connection URL
   */
  private buildConnectionUrl(config: DatabaseConfig): string {
    if (config.url || config.uri) {
      return config.url || config.uri || "";
    }

    let url = "mongodb://";

    if (config.username && config.password) {
      url += `${encodeURIComponent(config.username)}:${encodeURIComponent(
        config.password
      )}@`;
    }

    url += `${config.host || "localhost"}:${config.port || 27017}`;

    if (config.replicaSet) {
      url += `/?replicaSet=${config.replicaSet}`;
    }

    return url;
  }

  /**
   * Build MongoDB connection options
   */
  private buildConnectionOptions(config: DatabaseConfig): any {
    const options: any = {};

    // Pool configuration
    if (config.pool) {
      options.minPoolSize = config.pool.min;
      options.maxPoolSize = config.pool.max;
      if (config.pool.acquireTimeoutMillis) {
        options.serverSelectionTimeoutMS = config.pool.acquireTimeoutMillis;
      }
      if (config.pool.idleTimeoutMillis) {
        options.maxIdleTimeMS = config.pool.idleTimeoutMillis;
      }
    }

    // SSL/TLS configuration
    if (config.ssl) {
      if (typeof config.ssl === "boolean") {
        options.tls = config.ssl;
      } else {
        options.tls = config.ssl.enabled;
        if (config.ssl.rejectUnauthorized !== undefined) {
          options.tlsAllowInvalidCertificates = !config.ssl.rejectUnauthorized;
        }
        if (config.ssl.ca) options.tlsCAFile = config.ssl.ca;
        if (config.ssl.cert) options.tlsCertificateKeyFile = config.ssl.cert;
      }
    }

    // Connection timeouts
    if (config.connectTimeout) {
      options.connectTimeoutMS = config.connectTimeout;
    }
    if (config.socketTimeout) {
      options.socketTimeoutMS = config.socketTimeout;
    }

    // Keep alive
    if (config.keepAlive !== undefined) {
      options.keepAlive = config.keepAlive;
      if (config.keepAliveInitialDelay) {
        options.keepAliveInitialDelayMS = config.keepAliveInitialDelay;
      }
    }

    // MongoDB-specific options
    if (config.authSource) options.authSource = config.authSource;
    if (config.replicaSet) options.replicaSet = config.replicaSet;
    if (config.retryWrites !== undefined)
      options.retryWrites = config.retryWrites;
    if (config.w) options.w = config.w;
    if (config.journal !== undefined) options.journal = config.journal;
    if (config.readPreference) options.readPreference = config.readPreference;
    if (config.readConcern) options.readConcern = { level: config.readConcern };

    if (config.writeConcern) {
      options.writeConcern = {
        w: config.writeConcern.w,
        j: config.writeConcern.j,
        wtimeout: config.writeConcern.wtimeout,
      };
    }

    return options;
  }

  /**
   * Handle connection errors with helpful messages
   */
  private handleConnectionError(error: any): void {
    if (
      error.name === "MongoServerSelectionError" ||
      error.message.includes("SSL") ||
      error.message.includes("ECONNREFUSED")
    ) {
      console.error(
        "\n\x1b[31m%s\x1b[0m",
        "MongoDB Connection Failed: Unable to connect to the database."
      );
      console.error(
        "\x1b[33m%s\x1b[0m",
        "Hint: If you are using MongoDB Atlas, please ensure your current IP address is whitelisted in the Network Access settings."
      );
      console.error(
        "\x1b[33m%s\x1b[0m\n",
        "For development, you can allow access from anywhere (0.0.0.0/0), or add your specific IP."
      );
    }

    if (this.config?.events?.onError) {
      this.config.events.onError(error);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.endSession();
      this.session = null;
    }
    if (this.client) {
      await this.client.close();

      if (this.config?.events?.onDisconnect) {
        this.config.events.onDisconnect();
      }

      this.client = null;
      this.db = null;
    }
  }

  /**
   * Get the underlying MongoDB database instance
   */
  getDatabase(): Db | null {
    return this.db;
  }

  /**
   * Get a collection
   */
  getCollection<T extends Document = Document>(name: string): Collection<T> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<T>(name);
  }

  // ==========================================================================
  // SCHEMA OPERATIONS
  // ==========================================================================

  async createTable(
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    // Create collection with validation schema if columns define types
    const validationSchema = this.buildValidationSchema(columns);

    await this.db.createCollection(tableName, {
      validator: validationSchema
        ? { $jsonSchema: validationSchema }
        : undefined,
    });

    // Create indexes for unique columns
    const collection = this.db.collection(tableName);
    for (const col of columns) {
      if (col.unique && col.name !== "_id") {
        await collection.createIndex({ [col.name]: 1 }, { unique: true });
      }
    }
  }

  /**
   * Build MongoDB JSON Schema validation from column definitions
   */
  private buildValidationSchema(columns: ColumnDefinition[]): any {
    if (columns.length === 0) return null;

    const properties: any = {};
    const required: string[] = [];

    for (const col of columns) {
      if (col.name === "_id" || col.name === "id") continue;

      properties[col.name] = this.mapColumnToJsonSchema(col);

      if (!col.nullable && col.name !== "_id") {
        required.push(col.name);
      }
    }

    return {
      bsonType: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Map column definition to MongoDB JSON Schema type
   */
  private mapColumnToJsonSchema(col: ColumnDefinition): any {
    const typeMap: Record<string, string | string[]> = {
      string: "string",
      text: "string",
      integer: ["int", "long"],
      bigInteger: "long",
      float: "double",
      double: "double",
      decimal: "decimal",
      boolean: "bool",
      date: "date",
      datetime: "date",
      timestamp: "date",
      json: "object",
      array: "array",
      object: "object",
      objectId: "objectId",
      uuid: "string",
    };

    const bsonType = typeMap[col.type as string] || "string";

    const schema: any = { bsonType };

    if (col.length && (col.type === "string" || col.type === "varchar")) {
      schema.maxLength = col.length;
    }

    if (col.comment) {
      schema.description = col.comment;
    }

    return schema;
  }

  async dropTable(tableName: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await this.db
      .collection(tableName)
      .drop()
      .catch(() => {});
  }

  async hasTable(tableName: string): Promise<boolean> {
    if (!this.db) throw new Error("Database not connected");
    const collections = await this.db
      .listCollections({ name: tableName })
      .toArray();
    return collections.length > 0;
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    // MongoDB is schemaless - check if any document has this field
    if (!this.db) throw new Error("Database not connected");
    const count = await this.db
      .collection(tableName)
      .countDocuments({ [columnName]: { $exists: true } });
    return count > 0;
  }

  async renameTable(from: string, to: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await this.db.collection(from).rename(to);
  }

  // ==========================================================================
  // INDEX OPERATIONS
  // ==========================================================================

  async createIndex(
    tableName: string,
    columns: string[],
    options?: IndexOptions
  ): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    const collection = this.db.collection(tableName);
    const indexSpec: any = {};

    for (const col of columns) {
      indexSpec[col] = 1;
    }

    const indexOptions: any = {};
    if (options?.name) indexOptions.name = options.name;
    if (options?.unique) indexOptions.unique = options.unique;
    if (options?.sparse) indexOptions.sparse = options.sparse;
    if (options?.expireAfterSeconds)
      indexOptions.expireAfterSeconds = options.expireAfterSeconds;
    if (options?.partialFilterExpression)
      indexOptions.partialFilterExpression = options.partialFilterExpression;
    if (options?.collation) indexOptions.collation = options.collation;
    if (options?.weights) indexOptions.weights = options.weights;
    if (options?.defaultLanguage)
      indexOptions.default_language = options.defaultLanguage;
    if (options?.languageOverride)
      indexOptions.language_override = options.languageOverride;

    await collection.createIndex(indexSpec, indexOptions);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await this.db.collection(tableName).dropIndex(indexName);
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    if (!this.db) throw new Error("Database not connected");

    const indexes = await this.db.collection(tableName).indexes();

    return indexes.map((idx: any) => ({
      name: idx.name,
      columns: Object.keys(idx.key),
      unique: idx.unique || false,
      primary: idx.name === "_id_",
    }));
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  async select(table: string, options: SelectOptions): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");

    const collection = this.db.collection(table);
    const filter = this.buildFilter(options.where || []);
    const projection = this.buildProjection(options.columns);

    let cursor = collection.find(filter, {
      session: this.session || undefined,
    });

    if (projection) {
      cursor = cursor.project(projection);
    }

    if (options.orderBy && options.orderBy.length > 0) {
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

    // Normalize _id to id
    return results.map((doc) => {
      const { _id, id: existingId, ...rest } = doc;
      const normalizedId = _id?.toString ? _id.toString() : _id;
      return { id: normalizedId ?? existingId, _id, ...rest };
    });
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    const doc = { ...data };
    if (doc.id && !doc._id) {
      doc._id = doc.id;
      delete doc.id;
    }

    const result = await collection.insertOne(doc, {
      session: this.session || undefined,
    });

    return {
      id: result.insertedId.toString(),
      _id: result.insertedId,
      ...data,
    };
  }

  async insertMany(table: string, data: Record<string, any>[]): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    const docs = data.map((item) => {
      const doc = { ...item };
      if (doc.id && !doc._id) {
        doc._id = doc.id;
        delete doc.id;
      }
      return doc;
    });

    const result = await collection.insertMany(docs, {
      session: this.session || undefined,
    });

    return data.map((item, index) => ({
      id: result.insertedIds[index].toString(),
      _id: result.insertedIds[index],
      ...item,
    }));
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
      session: this.session || undefined,
    });

    if (result) {
      const { _id, ...rest } = result;
      return { id: _id?.toString(), _id, ...rest };
    }
    return null;
  }

  async updateMany(
    table: string,
    where: WhereClause[],
    data: Record<string, any>
  ): Promise<number> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    const filter = this.buildFilter(where);
    const update = { $set: data };

    const result = await collection.updateMany(filter, update, {
      session: this.session || undefined,
    });
    return result.modifiedCount;
  }

  async delete(table: string, id: any): Promise<boolean> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);
    const result = await collection.deleteOne(
      { _id: this.normalizeId(id) },
      { session: this.session || undefined }
    );
    return result.deletedCount === 1;
  }

  async deleteMany(table: string, where: WhereClause[]): Promise<number> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);
    const filter = this.buildFilter(where);
    const result = await collection.deleteMany(filter, {
      session: this.session || undefined,
    });
    return result.deletedCount;
  }

  async upsert(
    table: string,
    data: Record<string, any>,
    uniqueKeys: string[]
  ): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    const filter: any = {};
    for (const key of uniqueKeys) {
      filter[key === "id" ? "_id" : key] = data[key];
    }

    const result = await collection.findOneAndUpdate(
      filter,
      { $set: data },
      {
        upsert: true,
        returnDocument: "after",
        session: this.session || undefined,
      }
    );

    if (result) {
      const { _id, ...rest } = result;
      return { id: _id?.toString(), _id, ...rest };
    }
    return data;
  }

  // ==========================================================================
  // AGGREGATE OPERATIONS
  // ==========================================================================

  async aggregate(table: string, pipeline: AggregateStage[]): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);

    const results = await collection
      .aggregate(pipeline, { session: this.session || undefined })
      .toArray();

    // Normalize results
    return results.map((doc) => {
      if (doc._id !== undefined) {
        const { _id, ...rest } = doc;
        return {
          id: typeof _id === "object" ? _id.toString() : _id,
          _id,
          ...rest,
        };
      }
      return doc;
    });
  }

  async count(table: string, where?: WhereClause[]): Promise<number> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);
    const filter = where ? this.buildFilter(where) : {};
    return collection.countDocuments(filter, {
      session: this.session || undefined,
    });
  }

  async distinct(
    table: string,
    column: string,
    where?: WhereClause[]
  ): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const collection = this.db.collection(table);
    const filter = where ? this.buildFilter(where) : {};
    return collection.distinct(column === "id" ? "_id" : column, filter, {
      session: this.session || undefined,
    });
  }

  // ==========================================================================
  // TRANSACTION SUPPORT
  // ==========================================================================

  async beginTransaction(): Promise<void> {
    if (!this.client) throw new Error("Database not connected");
    this.session = this.client.startSession();
    this.session.startTransaction();
  }

  async commit(): Promise<void> {
    if (!this.session) throw new Error("No active transaction");
    await this.session.commitTransaction();
    await this.session.endSession();
    this.session = null;
  }

  async rollback(): Promise<void> {
    if (!this.session) throw new Error("No active transaction");
    await this.session.abortTransaction();
    await this.session.endSession();
    this.session = null;
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
    if (!this.db) throw new Error("Database not connected");

    // Return raw database for advanced operations
    if (query === "db") return this.db;

    // Execute as MongoDB command
    try {
      return await this.db.command(JSON.parse(query));
    } catch {
      // If not JSON, treat as collection name and return collection
      return this.db.collection(query);
    }
  }

  // ==========================================================================
  // CONNECTION POOL MANAGEMENT
  // ==========================================================================

  getPoolStats(): PoolStats {
    // MongoDB driver manages pool internally
    return {
      total: this.config?.pool?.max || 10,
      idle: 0,
      waiting: 0,
      active: this.client ? 1 : 0,
    };
  }

  async ping(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private buildFilter(where: WhereClause[]): any {
    if (where.length === 0) return {};

    const conditions: any[] = [];
    let currentGroup: any[] = [];
    let lastBoolean: "AND" | "OR" = "AND";

    for (const clause of where) {
      const condition = this.buildSingleCondition(clause);

      if (clause.boolean === "OR" && currentGroup.length > 0) {
        if (currentGroup.length === 1) {
          conditions.push(currentGroup[0]);
        } else {
          conditions.push({ $and: currentGroup });
        }
        currentGroup = [condition];
        lastBoolean = "OR";
      } else {
        currentGroup.push(condition);
      }
    }

    if (currentGroup.length > 0) {
      if (currentGroup.length === 1) {
        conditions.push(currentGroup[0]);
      } else {
        conditions.push({ $and: currentGroup });
      }
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];

    return lastBoolean === "OR" ? { $or: conditions } : { $and: conditions };
  }

  private buildSingleCondition(clause: WhereClause): any {
    const column = clause.column === "id" ? "_id" : clause.column;
    let value = clause.value;

    // Normalize ObjectId fields
    if (column === "_id" || column.endsWith("_id")) {
      value = this.normalizeIdValue(value);
    }

    switch (clause.operator) {
      case "=":
        return { [column]: value };
      case "!=":
      case "<>":
        return { [column]: { $ne: value } };
      case ">":
        return { [column]: { $gt: value } };
      case "<":
        return { [column]: { $lt: value } };
      case ">=":
        return { [column]: { $gte: value } };
      case "<=":
        return { [column]: { $lte: value } };
      case "IN":
        return { [column]: { $in: Array.isArray(value) ? value : [value] } };
      case "NOT IN":
        return { [column]: { $nin: Array.isArray(value) ? value : [value] } };
      case "LIKE":
      case "ILIKE":
        return {
          [column]: {
            $regex: new RegExp(
              value.replace(/%/g, ".*").replace(/_/g, "."),
              "i"
            ),
          },
        };
      case "NOT LIKE":
      case "NOT ILIKE":
        return {
          [column]: {
            $not: {
              $regex: new RegExp(
                value.replace(/%/g, ".*").replace(/_/g, "."),
                "i"
              ),
            },
          },
        };
      case "BETWEEN":
        return { [column]: { $gte: value[0], $lte: value[1] } };
      case "NOT BETWEEN":
        return {
          $or: [
            { [column]: { $lt: value[0] } },
            { [column]: { $gt: value[1] } },
          ],
        };
      case "IS NULL":
        return { [column]: null };
      case "IS NOT NULL":
        return { [column]: { $ne: null } };
      case "EXISTS":
        return { [column]: { $exists: true } };
      case "NOT EXISTS":
        return { [column]: { $exists: false } };
      case "REGEXP":
        return { [column]: { $regex: new RegExp(value) } };
      case "NOT REGEXP":
        return { [column]: { $not: { $regex: new RegExp(value) } } };
      // Array operators
      case "@>":
        return { [column]: { $all: Array.isArray(value) ? value : [value] } };
      case "<@":
        return { [column]: { $in: Array.isArray(value) ? value : [value] } };
      case "&&":
        return {
          [column]: {
            $elemMatch: { $in: Array.isArray(value) ? value : [value] },
          },
        };
      default:
        return { [column]: value };
    }
  }

  private normalizeIdValue(value: any): any {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      return value.map((v) => this.normalizeIdValue(v));
    }

    if (typeof value === "object" && typeof value.toHexString === "function") {
      return value;
    }

    if (
      typeof value === "string" &&
      value.length === 24 &&
      /^[a-fA-F0-9]{24}$/.test(value)
    ) {
      return this.normalizeId(value);
    }

    return value;
  }

  private buildProjection(columns?: string[]): any {
    if (!columns || columns.length === 0 || columns.includes("*")) {
      return null;
    }

    const projection: any = {};
    for (const col of columns) {
      const field = col === "id" ? "_id" : col;
      projection[field] = 1;
    }

    // Always include _id unless explicitly excluded
    if (!columns.includes("id") && !columns.includes("_id")) {
      projection._id = 0;
    }

    return projection;
  }

  private normalizeId(id: any): any {
    const { ObjectId } = ModuleLoader.require("mongodb");

    if (Array.isArray(id)) {
      return id.map((item) => this.normalizeId(item));
    }
    if (id instanceof ObjectId) return id;
    if (typeof id === "string" && ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    return id;
  }
}
