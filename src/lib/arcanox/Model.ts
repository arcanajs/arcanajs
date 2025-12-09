import { ModuleLoader } from "../../utils/ModuleLoader";
import { QueryBuilder } from "./QueryBuilder";
import { BelongsTo } from "./relations/BelongsTo";
import { BelongsToMany } from "./relations/BelongsToMany";
import { HasMany } from "./relations/HasMany";
import { HasOne } from "./relations/HasOne";
import type { DatabaseAdapter } from "./types";

/**
 * Relation types for arcanox relationships
 */
export type RelationType = "hasOne" | "hasMany" | "belongsTo" | "belongsToMany";

export interface RelationConfig {
  type: RelationType;
  related: typeof Model;
  foreignKey?: string;
  localKey?: string;
  pivotTable?: string;
}

import { Macroable } from "./support/Macroable";

declare global {
  var ArcanaJSDatabaseAdapter: DatabaseAdapter;
}

/**
 * Base Model class - Arcanox ORM
 */
export class Model<T = any> extends Macroable {
  // Static properties
  protected static adapter: DatabaseAdapter;
  protected static tableName: string;
  protected static primaryKey: string = "id";
  protected static connection: string = "default";

  // Instance properties
  protected attributes: Record<string, any> = {};
  protected original: Record<string, any> = {};
  protected relations: Record<string, any> = {};
  protected exists: boolean = false;

  // Configuration
  protected fillable: string[] = [];
  protected guarded: string[] = ["id"];
  protected hidden: string[] = [];
  protected visible: string[] = [];
  protected casts: Record<string, string> = {};
  protected dates: string[] = [];
  protected timestamps: boolean = true;
  protected createdAt: string = "created_at";
  protected updatedAt: string = "updated_at";
  protected softDeletes: boolean = false;
  protected deletedAt: string = "deleted_at";

  /**
   * Get the primary key value
   */
  get id(): any {
    const constructor = this.constructor as typeof Model;
    const primaryKey = constructor.primaryKey || "id";

    let value = this.getAttribute(primaryKey);
    if ((value === undefined || value === null) && primaryKey !== "_id") {
      value = this.getAttribute("_id");
    }

    return value;
  }

  /**
   * Set the primary key value
   */
  set id(value: any) {
    const constructor = this.constructor as typeof Model;
    const primaryKey = constructor.primaryKey || "id";

    this.setAttribute(primaryKey, value);

    if (primaryKey !== "_id") {
      this.setAttribute("_id", value);
    }
  }

  /**
   * Set the database adapter
   */
  static setAdapter(adapter: DatabaseAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Get the database adapter
   */
  protected static getAdapter(): DatabaseAdapter {
    const adapter = this.adapter || global.ArcanaJSDatabaseAdapter;
    if (!adapter) {
      throw new Error(
        "Database adapter not set. Call Model.setAdapter() or ensure global.ArcanaJSDatabaseAdapter is set."
      );
    }
    return adapter;
  }

  /**
   * Get the table name
   */
  static getTable(): string {
    if (this.tableName) {
      return this.tableName;
    }

    // Try to get table name from instance property (e.g. protected table = 'users')
    // This is useful when class names are minified in production
    try {
      const instance = new this() as any;
      if (instance.table) {
        return instance.table;
      }
    } catch (e) {
      // Ignore instantiation errors
    }

    // Auto-generate table name from class name (pluralize and snake_case)
    const className = this.name;
    return this.pluralize(this.snakeCase(className));
  }

  /**
   * Create a new query builder instance
   */
  static query<T>(): QueryBuilder<T> {
    return new QueryBuilder<T>(this.getTable(), this.getAdapter()).setModel(
      this
    );
  }

  /**
   * Get all records
   */
  static async all<T>(): Promise<T[]> {
    return await this.query<T>().get();
  }

  /**
   * Find a record by ID
   */
  static async find<T>(id: any): Promise<T | null> {
    const data = await this.query<T>().where(this.primaryKey, id).first();
    return data ? this.hydrate<T>(data) : null;
  }

  /**
   * Find a record by ID or throw exception
   */
  static async findOrFail<T>(id: any): Promise<T> {
    const model = await this.find<T>(id);
    if (!model) {
      throw new Error(`Model not found with ${this.primaryKey}: ${id}`);
    }
    return model;
  }

  /**
   * Create a WHERE query
   */
  static where<T>(column: string, operator: any, value?: any): QueryBuilder<T> {
    return this.query<T>().where(column, operator, value);
  }

  /**
   * Create a new record
   */
  static async create<T>(data: Partial<T>): Promise<T> {
    const instance = new this() as any;
    instance.fill(data);

    if (instance.timestamps) {
      const now = new Date();
      instance.attributes[instance.createdAt] = now;
      instance.attributes[instance.updatedAt] = now;
    }

    const result = await this.getAdapter().insert(
      this.getTable(),
      instance.attributes
    );

    const id = result[this.primaryKey] || result.id || result.insertId;
    instance.attributes[this.primaryKey] = id;
    if (this.primaryKey !== "id") {
      instance.attributes.id = id;
    }

    instance.exists = true;
    instance.syncOriginal();

    return instance as T;
  }

  /**
   * Update a record
   */
  static async update<T>(id: any, data: Partial<T>): Promise<T> {
    const instance = await this.findOrFail<T>(id);
    await (instance as any).update(data);
    return instance;
  }

  /**
   * Delete a record
   */
  static async destroy(id: any): Promise<boolean> {
    const instance = await this.find(id);
    if (!instance) return false;
    return await (instance as any).delete();
  }

  /**
   * First or create
   */
  static async firstOrCreate<T>(
    attributes: Partial<T>,
    values: Partial<T> = {}
  ): Promise<T> {
    const query = this.query<T>();

    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }

    const existing = await query.first();
    if (existing) {
      return this.hydrate<T>(existing);
    }

    return await this.create<T>({ ...attributes, ...values });
  }

  /**
   * Update or create
   */
  static async updateOrCreate<T>(
    attributes: Partial<T>,
    values: Partial<T> = {}
  ): Promise<T> {
    const query = this.query<T>();

    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }

    const existing = await query.first();
    if (existing) {
      const instance = this.hydrate<T>(existing) as any;
      await instance.update(values);
      return instance;
    }

    return await this.create<T>({ ...attributes, ...values });
  }

  /**
   * Hydrate a model instance from data
   */
  protected static hydrate<T>(data: any): T {
    const instance = new this() as any;
    const hydrated = { ...data };
    // Ensure both id and _id are available for Mongo-style results
    if (hydrated._id !== undefined && hydrated.id === undefined) {
      hydrated.id = hydrated._id;
    }

    instance.attributes = hydrated;
    instance.original = { ...hydrated };
    instance.exists = true;
    return instance as T;
  }

  /**
   * Fill model attributes
   */
  fill(attributes: Partial<T>): this {
    for (const [key, value] of Object.entries(attributes)) {
      if (this.isFillable(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Check if attribute is fillable
   */
  protected isFillable(key: string): boolean {
    if (this.fillable.length > 0) {
      return this.fillable.includes(key);
    }
    return !this.guarded.includes(key);
  }

  /**
   * Set an attribute
   */
  setAttribute(key: string, value: any): void {
    // Check for mutator
    const mutator = `set${this.studly(key)}Attribute`;
    if (typeof (this as any)[mutator] === "function") {
      value = (this as any)[mutator](value);
    }

    this.attributes[key] = this.castAttribute(key, value);
  }

  /**
   * Get an attribute
   */
  getAttribute(key: string): any {
    // Check for accessor
    const accessor = `get${this.studly(key)}Attribute`;
    if (typeof (this as any)[accessor] === "function") {
      return (this as any)[accessor]();
    }

    const value = this.attributes[key];
    return this.castAttribute(key, value, true);
  }

  /**
   * Cast attribute to specified type
   */
  protected castAttribute(
    key: string,
    value: any,
    isGetting: boolean = false
  ): any {
    if (value === null || value === undefined) return value;

    const cast = this.casts[key];
    if (!cast) return value;

    if (isGetting) {
      switch (cast) {
        case "int":
        case "integer":
          return parseInt(value);
        case "float":
        case "double":
          return parseFloat(value);
        case "string":
          return String(value);
        case "bool":
        case "boolean":
          return Boolean(value);
        case "array":
        case "json":
          return typeof value === "string" ? JSON.parse(value) : value;
        case "date":
        case "datetime":
          return value instanceof Date ? value : new Date(value);
        case "objectId":
          if (typeof value === "string" && value.length === 24) {
            try {
              const mongodb = ModuleLoader.require("mongodb");
              if (mongodb && mongodb.ObjectId) {
                return new mongodb.ObjectId(value);
              }
              return value;
            } catch (e) {
              console.error("Arcanox Model: Failed to cast to ObjectId", e);
              return value;
            }
          }
          return value;
        default:
          return value;
      }
    } else {
      switch (cast) {
        case "array":
        case "json":
          return typeof value === "object" ? JSON.stringify(value) : value;
        case "date":
        case "datetime":
          return value instanceof Date ? value : new Date(value);
        case "objectId":
          // When setting, convert string to ObjectId
          if (typeof value === "string" && value.length === 24) {
            try {
              const mongodb = ModuleLoader.require("mongodb");
              if (mongodb && mongodb.ObjectId) {
                return new mongodb.ObjectId(value);
              }
              return value;
            } catch (e) {
              console.error("Arcanox Model: Failed to cast to ObjectId", e);
              return value;
            }
          }
          return value;
        default:
          return value;
      }
    }
  }

  /**
   * Save the model
   */
  async save(): Promise<this> {
    const constructor = this.constructor as typeof Model;

    if (this.timestamps) {
      const now = new Date();
      if (!this.exists) {
        this.attributes[this.createdAt] = now;
      }
      this.attributes[this.updatedAt] = now;
    }

    if (this.exists) {
      // Update existing record
      const id = this.attributes[constructor.primaryKey];
      await constructor
        .getAdapter()
        .update(constructor.getTable(), id, this.attributes);
    } else {
      // Insert new record
      const result = await constructor
        .getAdapter()
        .insert(constructor.getTable(), this.attributes);

      const id = result[constructor.primaryKey] || result.id || result.insertId;
      this.attributes[constructor.primaryKey] = id;
      if (constructor.primaryKey !== "id") {
        this.attributes.id = id;
      }

      this.exists = true;
    }

    this.syncOriginal();
    return this;
  }

  /**
   * Update the model
   */
  async update(attributes: Partial<T>): Promise<this> {
    this.fill(attributes);
    return await this.save();
  }

  /**
   * Delete the model
   */
  async delete(): Promise<boolean> {
    const constructor = this.constructor as typeof Model;

    if (this.softDeletes) {
      this.attributes[this.deletedAt] = new Date();
      await this.save();
      return true;
    }

    const id = this.attributes[constructor.primaryKey];
    return await constructor.getAdapter().delete(constructor.getTable(), id);
  }

  /**
   * Force delete (ignore soft deletes)
   */
  async forceDelete(): Promise<boolean> {
    const constructor = this.constructor as typeof Model;
    const id = this.attributes[constructor.primaryKey];
    return await constructor.getAdapter().delete(constructor.getTable(), id);
  }

  /**
   * Restore soft deleted model
   */
  async restore(): Promise<this> {
    if (this.softDeletes) {
      this.attributes[this.deletedAt] = null;
      await this.save();
    }
    return this;
  }

  /**
   * Sync original attributes
   */
  protected syncOriginal(): void {
    this.original = { ...this.attributes };
  }

  /**
   * Get dirty attributes (changed since last sync)
   */
  getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (this.original[key] !== value) {
        dirty[key] = value;
      }
    }
    return dirty;
  }

  /**
   * Check if model is dirty
   */
  isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0;
  }

  constructor(attributes: Partial<T> = {}) {
    super();
    this.fill(attributes);
  }

  /**
   * Convert model to JSON
   */
  toJSON(): Record<string, any> {
    const json: Record<string, any> = {};

    // Add attributes
    for (const [key, value] of Object.entries(this.attributes)) {
      if (this.hidden.includes(key)) continue;
      if (this.visible.length > 0 && !this.visible.includes(key)) continue;
      json[key] = this.getAttribute(key);
    }

    // Add relations
    for (const [key, value] of Object.entries(this.relations)) {
      json[key] = value;
    }

    return json;
  }

  /**
   * Define a one-to-one relationship
   */
  hasOne<R extends Model>(
    related: new () => R,
    foreignKey?: string,
    localKey?: string
  ): HasOne<R> {
    const instance = new related();
    const modelClass = this.constructor as typeof Model;
    const foreign =
      foreignKey || `${modelClass.singularize(modelClass.getTable())}_id`;
    const local = localKey || "id";

    return new HasOne<R>(instance.newQuery(), this, foreign, local);
  }

  /**
   * Define a one-to-many relationship
   */
  hasMany<R extends Model>(
    related: new () => R,
    foreignKey?: string,
    localKey?: string
  ): HasMany<R> {
    const instance = new related();
    const modelClass = this.constructor as typeof Model;
    const foreign =
      foreignKey || `${modelClass.singularize(modelClass.getTable())}_id`;
    const local = localKey || "id";

    return new HasMany<R>(instance.newQuery(), this, foreign, local);
  }

  /**
   * Define an inverse one-to-one or many relationship
   */
  belongsTo<R extends Model>(
    related: new () => R,
    foreignKey?: string,
    ownerKey?: string
  ): BelongsTo<R> {
    const instance = new related();
    const relatedClass = instance.constructor as typeof Model;
    const foreign =
      foreignKey || `${relatedClass.singularize(relatedClass.getTable())}_id`;
    const owner = ownerKey || "id";

    return new BelongsTo<R>(instance.newQuery(), this, foreign, owner);
  }

  /**
   * Define a many-to-many relationship
   */
  belongsToMany<R extends Model>(
    related: new () => R,
    table?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey?: string,
    relatedKey?: string
  ): BelongsToMany<R> {
    const instance = new related();
    const pivotTable = table || this.guessPivotTable(instance);
    const modelClass = this.constructor as typeof Model;
    const relatedClass = instance.constructor as typeof Model;

    const foreignPivot =
      foreignPivotKey || `${modelClass.singularize(modelClass.getTable())}_id`;
    const relatedPivot =
      relatedPivotKey ||
      `${relatedClass.singularize(relatedClass.getTable())}_id`;
    const parent = parentKey || "id";
    const relatedK = relatedKey || "id";

    return new BelongsToMany<R>(
      instance.newQuery(),
      this,
      pivotTable,
      foreignPivot,
      relatedPivot,
      parent,
      relatedK
    );
  }

  /**
   * Guess the pivot table name (alphabetical order of table names)
   */
  protected guessPivotTable(related: Model): string {
    const modelClass = this.constructor as typeof Model;
    const relatedClass = related.constructor as typeof Model;
    const segments = [
      modelClass.singularize(modelClass.getTable()),
      relatedClass.singularize(relatedClass.getTable()),
    ];
    segments.sort();
    return segments.join("_");
  }

  /**
   * Eager load relationships
   */
  static with<T>(relations: string | string[]): QueryBuilder<T> {
    return this.query<T>().with(relations);
  }

  /**
   * Set a loaded relationship
   */
  setRelation(relation: string, value: any): this {
    this.relations[relation] = value;
    return this;
  }

  /**
   * Get a loaded relationship
   */
  getRelation(relation: string): any {
    return this.relations[relation];
  }

  /**
   * Check if a relationship is loaded
   */
  relationLoaded(relation: string): boolean {
    return this.relations[relation] !== undefined;
  }

  /**
   * Create a new query builder for the model
   */
  newQuery(): QueryBuilder<T> {
    return (this.constructor as typeof Model).query<T>();
  }

  /**
   * Helper: Convert string to snake_case
   */
  protected static snakeCase(str: string): string {
    if (!str) return str;
    return str
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
  }

  /**
   * Helper: Pluralize string (simple implementation)
   */
  protected static pluralize(str: string): string {
    if (str.endsWith("y")) {
      return str.slice(0, -1) + "ies";
    }
    if (str.endsWith("s")) {
      return str + "es";
    }
    return str + "s";
  }

  /**
   * Helper: Singularize string (simple implementation)
   */
  public static singularize(str: string): string {
    if (str.endsWith("ies")) {
      return str.slice(0, -3) + "y";
    }
    if (str.endsWith("es") && !str.endsWith("ss")) {
      return str.slice(0, -2);
    }
    if (str.endsWith("s") && !str.endsWith("ss")) {
      return str.slice(0, -1);
    }
    return str;
  }

  /**
   * Helper: Convert to StudlyCase
   */
  protected studly(str: string): string {
    if (!str) return str;
    return str.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
  }
}
