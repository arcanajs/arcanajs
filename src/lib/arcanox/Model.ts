import { ModuleLoader } from "../../utils/ModuleLoader";
import { QueryBuilder } from "./QueryBuilder";
import { BelongsTo } from "./relations/BelongsTo";
import { BelongsToMany } from "./relations/BelongsToMany";
import { HasMany } from "./relations/HasMany";
import { HasOne } from "./relations/HasOne";
import { Macroable } from "./support/Macroable";
import type { DatabaseAdapter } from "./types";

/**
 * Hook context for model events
 */
export interface HookContext {
  connection?: string;
  transaction?: any;
  userId?: string | number;
  metadata?: Record<string, any>;
}

/**
 * Relation types for arcanox relationships
 */
export type RelationType =
  | "hasOne"
  | "hasMany"
  | "belongsTo"
  | "belongsToMany"
  | "morphTo"
  | "morphMany"
  | "morphOne";

export interface RelationConfig {
  type: RelationType;
  related: typeof Model;
  foreignKey?: string;
  localKey?: string;
  pivotTable?: string;
  morphName?: string;
}

/**
 * Model hook types
 */
export type ModelHook =
  | "creating"
  | "created"
  | "updating"
  | "updated"
  | "saving"
  | "saved"
  | "deleting"
  | "deleted"
  | "restoring"
  | "restored"
  | "forceDeleting"
  | "forceDeleted"
  | "retrieved";

export type HookCallback<T = any> = (
  model: T,
  context?: HookContext
) => void | boolean | Promise<void | boolean>;

/**
 * Cast types supported by the Model
 */
export type CastType =
  | "string"
  | "int"
  | "integer"
  | "float"
  | "double"
  | "decimal"
  | "bool"
  | "boolean"
  | "array"
  | "json"
  | "object"
  | "collection"
  | "date"
  | "datetime"
  | "timestamp"
  | "immutable_date"
  | "immutable_datetime"
  | "encrypted"
  | "hashed"
  | "objectId"
  | `decimal:${number}`
  | `date:${string}`
  | `datetime:${string}`
  | `enum:${string}`;

/**
 * Custom caster interface
 */
export interface AttributeCaster {
  get(value: any, attribute: string, model: Model): any;
  set(value: any, attribute: string, model: Model): any;
}

/**
 * Model event dispatcher
 */
export class ModelEventDispatcher {
  private static listeners: Map<string, Map<ModelHook, HookCallback[]>> =
    new Map();
  private static globalListeners: Map<ModelHook, HookCallback[]> = new Map();

  static register(
    modelName: string,
    hook: ModelHook,
    callback: HookCallback
  ): void {
    if (!this.listeners.has(modelName)) {
      this.listeners.set(modelName, new Map());
    }
    const modelHooks = this.listeners.get(modelName)!;
    if (!modelHooks.has(hook)) {
      modelHooks.set(hook, []);
    }
    modelHooks.get(hook)!.push(callback);
  }

  static registerGlobal(hook: ModelHook, callback: HookCallback): void {
    if (!this.globalListeners.has(hook)) {
      this.globalListeners.set(hook, []);
    }
    this.globalListeners.get(hook)!.push(callback);
  }

  static async dispatch(
    modelName: string,
    hook: ModelHook,
    model: any,
    context?: HookContext
  ): Promise<boolean> {
    // Execute global listeners first
    const globalCallbacks = this.globalListeners.get(hook) || [];
    for (const callback of globalCallbacks) {
      const result = await callback(model, context);
      if (result === false) return false;
    }

    // Execute model-specific listeners
    const modelHooks = this.listeners.get(modelName);
    if (modelHooks) {
      const callbacks = modelHooks.get(hook) || [];
      for (const callback of callbacks) {
        const result = await callback(model, context);
        if (result === false) return false;
      }
    }

    return true;
  }

  static clear(modelName?: string): void {
    if (modelName) {
      this.listeners.delete(modelName);
    } else {
      this.listeners.clear();
      this.globalListeners.clear();
    }
  }
}

/**
 * Model observer base class
 */
export abstract class Observer<T extends Model = Model> {
  creating?(model: T): void | boolean | Promise<void | boolean>;
  created?(model: T): void | Promise<void>;
  updating?(model: T): void | boolean | Promise<void | boolean>;
  updated?(model: T): void | Promise<void>;
  saving?(model: T): void | boolean | Promise<void | boolean>;
  saved?(model: T): void | Promise<void>;
  deleting?(model: T): void | boolean | Promise<void | boolean>;
  deleted?(model: T): void | Promise<void>;
  restoring?(model: T): void | boolean | Promise<void | boolean>;
  restored?(model: T): void | Promise<void>;
  forceDeleting?(model: T): void | boolean | Promise<void | boolean>;
  forceDeleted?(model: T): void | Promise<void>;
  retrieved?(model: T): void | Promise<void>;
}

/**
 * Exception thrown when a model is not found
 */
export class ModelNotFoundException extends Error {
  public model: string;
  public ids: any[];

  constructor(message: string, model: string, ids?: any | any[]) {
    super(message);
    this.name = "ModelNotFoundException";
    this.model = model;
    this.ids = ids ? (Array.isArray(ids) ? ids : [ids]) : [];
  }

  /**
   * Get the affected model IDs
   */
  getIds(): any[] {
    return this.ids;
  }

  /**
   * Get the affected model name
   */
  getModel(): string {
    return this.model;
  }
}

/**
 * Exception thrown when mass assignment is attempted on a guarded attribute
 */
export class MassAssignmentException extends Error {
  public attributes: string[];

  constructor(attributes: string | string[]) {
    const attrs = Array.isArray(attributes) ? attributes : [attributes];
    super(
      `Add [${attrs.join(", ")}] to fillable property to allow mass assignment.`
    );
    this.name = "MassAssignmentException";
    this.attributes = attrs;
  }
}

declare global {
  var ArcanaJSDatabaseAdapter: DatabaseAdapter;
}

/**
 * Base Model class - Arcanox ORM
 * Professional ActiveRecord implementation with hooks, events, and advanced casting
 */
export class Model<T = any> extends Macroable {
  // Static properties
  protected static adapter: DatabaseAdapter;
  protected static tableName: string;
  protected static primaryKey: string = "id";
  protected static connection: string = "default";
  protected static incrementing: boolean = true;
  protected static keyType: "int" | "string" = "int";
  protected static perPage: number = 15;

  // Boot tracking
  private static bootedModels: Set<string> = new Set();
  private static bootingCallbacks: Map<string, (() => void)[]> = new Map();
  private static bootedCallbacks: Map<string, (() => void)[]> = new Map();

  // Global scopes
  protected static globalScopes: Map<
    string,
    Map<string, (query: QueryBuilder<any>) => void>
  > = new Map();

  // Custom casters
  protected static customCasts: Map<string, AttributeCaster> = new Map();

  // Instance properties
  protected attributes: Record<string, any> = {};
  protected original: Record<string, any> = {};
  protected changes: Record<string, any> = {};
  protected relations: Record<string, any> = {};
  protected exists: boolean = false;
  protected wasRecentlyCreated: boolean = false;

  // Configuration
  protected fillable: string[] = [];
  protected guarded: string[] = ["id"];
  protected hidden: string[] = [];
  protected visible: string[] = [];
  protected appends: string[] = [];
  protected casts: Record<string, CastType | AttributeCaster> = {};
  protected dates: string[] = [];
  protected timestamps: boolean = true;
  protected createdAt: string = "created_at";
  protected updatedAt: string = "updated_at";
  protected softDeletes: boolean = false;
  protected deletedAt: string = "deleted_at";
  protected dateFormat: string = "YYYY-MM-DD HH:mm:ss";
  protected dispatchesEvents: Record<string, new (...args: any[]) => any> = {};

  // Touch relationships on update
  protected touches: string[] = [];

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
   * Boot the model (called once per model class)
   */
  protected static boot(): void {
    // Override in subclasses to add boot logic
  }

  /**
   * Check if model has been booted
   */
  protected static bootIfNotBooted(): void {
    if (!this.bootedModels.has(this.name)) {
      this.bootedModels.add(this.name);

      // Fire booting callbacks
      const bootingCallbacks = this.bootingCallbacks.get(this.name) || [];
      for (const callback of bootingCallbacks) {
        callback();
      }

      this.boot();

      // Fire booted callbacks
      const bootedCallbacks = this.bootedCallbacks.get(this.name) || [];
      for (const callback of bootedCallbacks) {
        callback();
      }
    }
  }

  /**
   * Register a booting callback
   */
  static booting(callback: () => void): void {
    if (!this.bootingCallbacks.has(this.name)) {
      this.bootingCallbacks.set(this.name, []);
    }
    this.bootingCallbacks.get(this.name)!.push(callback);
  }

  /**
   * Register a booted callback
   */
  static booted(callback: () => void): void {
    if (!this.bootedCallbacks.has(this.name)) {
      this.bootedCallbacks.set(this.name, []);
    }
    this.bootedCallbacks.get(this.name)!.push(callback);
  }

  /**
   * Register a model observer
   */
  static observe<T extends Model>(
    observer: Observer<T> | (new () => Observer<T>)
  ): void {
    const observerInstance =
      typeof observer === "function" ? new observer() : observer;
    const hooks: ModelHook[] = [
      "creating",
      "created",
      "updating",
      "updated",
      "saving",
      "saved",
      "deleting",
      "deleted",
      "restoring",
      "restored",
      "forceDeleting",
      "forceDeleted",
      "retrieved",
    ];

    for (const hook of hooks) {
      const method = observerInstance[hook as keyof Observer<T>];
      if (typeof method === "function") {
        ModelEventDispatcher.register(
          this.name,
          hook,
          method.bind(observerInstance)
        );
      }
    }
  }

  /**
   * Register a global scope
   */
  static addGlobalScope(
    name: string,
    scope: (query: QueryBuilder<any>) => void
  ): void {
    if (!this.globalScopes.has(this.name)) {
      this.globalScopes.set(this.name, new Map());
    }
    this.globalScopes.get(this.name)!.set(name, scope);
  }

  /**
   * Remove a global scope
   */
  static removeGlobalScope(name: string): void {
    const scopes = this.globalScopes.get(this.name);
    if (scopes) {
      scopes.delete(name);
    }
  }

  /**
   * Get all global scopes for this model
   */
  static getGlobalScopes(): Map<string, (query: QueryBuilder<any>) => void> {
    return this.globalScopes.get(this.name) || new Map();
  }

  /**
   * Register a custom caster
   */
  static registerCast(name: string, caster: AttributeCaster): void {
    this.customCasts.set(name, caster);
  }

  /**
   * Register hook callbacks
   */
  static creating(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "creating", callback);
  }

  static created(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "created", callback);
  }

  static updating(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "updating", callback);
  }

  static updated(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "updated", callback);
  }

  static saving(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "saving", callback);
  }

  static saved(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "saved", callback);
  }

  static deleting(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "deleting", callback);
  }

  static deleted(callback: HookCallback): void {
    ModelEventDispatcher.register(this.name, "deleted", callback);
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

    // Try to get table name from instance property
    try {
      const instance = new this() as any;
      if (instance.table) {
        return instance.table;
      }
    } catch (e) {
      // Ignore instantiation errors
    }

    // Auto-generate table name from class name
    const className = this.name;
    return this.pluralize(this.snakeCase(className));
  }

  /**
   * Get the primary key name
   */
  static getKeyName(): string {
    return this.primaryKey;
  }

  /**
   * Get the key type
   */
  static getKeyType(): "int" | "string" {
    return this.keyType;
  }

  /**
   * Check if the model uses incrementing IDs
   */
  static getIncrementing(): boolean {
    return this.incrementing;
  }

  /**
   * Create a new query builder instance with global scopes applied
   */
  static query<T>(): QueryBuilder<T> {
    this.bootIfNotBooted();

    const query = new QueryBuilder<T>(
      this.getTable(),
      this.getAdapter()
    ).setModel(this);

    // Apply global scopes
    const scopes = this.getGlobalScopes();
    for (const [, scope] of scopes) {
      scope(query);
    }

    return query;
  }

  /**
   * Create a query without global scopes
   */
  static withoutGlobalScopes<T>(): QueryBuilder<T> {
    this.bootIfNotBooted();
    return new QueryBuilder<T>(this.getTable(), this.getAdapter()).setModel(
      this
    );
  }

  /**
   * Create a query without specific global scopes
   */
  static withoutGlobalScope<T>(...names: string[]): QueryBuilder<T> {
    this.bootIfNotBooted();

    const query = new QueryBuilder<T>(
      this.getTable(),
      this.getAdapter()
    ).setModel(this);
    const scopes = this.getGlobalScopes();

    for (const [name, scope] of scopes) {
      if (!names.includes(name)) {
        scope(query);
      }
    }

    return query;
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
    if (!data) return null;

    const model = this.hydrate<T>(data);
    await ModelEventDispatcher.dispatch(this.name, "retrieved", model);
    return model;
  }

  /**
   * Find multiple records by IDs
   */
  static async findMany<T>(ids: any[]): Promise<T[]> {
    const results = await this.query<T>().whereIn(this.primaryKey, ids).get();
    const models: T[] = [];

    for (const data of results) {
      const model = this.hydrate<T>(data);
      await ModelEventDispatcher.dispatch(this.name, "retrieved", model);
      models.push(model);
    }

    return models;
  }

  /**
   * Find a record by ID or throw exception
   */
  static async findOrFail<T>(id: any): Promise<T> {
    const model = await this.find<T>(id);
    if (!model) {
      throw new ModelNotFoundException(
        `Model not found with ${this.primaryKey}: ${id}`,
        this.name,
        id
      );
    }
    return model;
  }

  /**
   * Find or create a new instance (doesn't save)
   */
  static async findOrNew<T>(id: any): Promise<T> {
    const model = await this.find<T>(id);
    if (model) return model;
    return new this() as unknown as T;
  }

  /**
   * Create a WHERE query
   */
  static where<T>(column: string, operator: any, value?: any): QueryBuilder<T> {
    return this.query<T>().where(column, operator, value);
  }

  /**
   * Create a WHERE IN query
   */
  static whereIn<T>(column: string, values: any[]): QueryBuilder<T> {
    return this.query<T>().whereIn(column, values);
  }

  /**
   * Create a WHERE NOT IN query
   */
  static whereNotIn<T>(column: string, values: any[]): QueryBuilder<T> {
    return this.query<T>().whereNotIn(column, values);
  }

  /**
   * Create a WHERE NULL query
   */
  static whereNull<T>(column: string): QueryBuilder<T> {
    return this.query<T>().whereNull(column);
  }

  /**
   * Create a WHERE NOT NULL query
   */
  static whereNotNull<T>(column: string): QueryBuilder<T> {
    return this.query<T>().whereNotNull(column);
  }

  /**
   * Create a new record
   */
  static async create<T>(data: Partial<T>): Promise<T> {
    const instance = new this() as any;
    instance.fill(data);

    // Fire creating hook
    const shouldContinue = await ModelEventDispatcher.dispatch(
      this.name,
      "creating",
      instance
    );
    if (shouldContinue === false) {
      throw new Error("Model creation was cancelled by creating hook");
    }

    // Fire saving hook
    const shouldSave = await ModelEventDispatcher.dispatch(
      this.name,
      "saving",
      instance
    );
    if (shouldSave === false) {
      throw new Error("Model save was cancelled by saving hook");
    }

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
    instance.wasRecentlyCreated = true;
    instance.syncOriginal();

    // Fire created and saved hooks
    await ModelEventDispatcher.dispatch(this.name, "created", instance);
    await ModelEventDispatcher.dispatch(this.name, "saved", instance);

    return instance as T;
  }

  /**
   * Create multiple records
   */
  static async createMany<T>(records: Partial<T>[]): Promise<T[]> {
    const results: T[] = [];
    for (const record of records) {
      results.push(await this.create<T>(record));
    }
    return results;
  }

  /**
   * Insert records without model events (bulk insert)
   */
  static async insert<T>(records: Partial<T>[]): Promise<boolean> {
    if (records.length === 0) return true;

    const preparedRecords = records.map((record) => {
      const instance = new this() as any;
      instance.fill(record);

      if (instance.timestamps) {
        const now = new Date();
        instance.attributes[instance.createdAt] = now;
        instance.attributes[instance.updatedAt] = now;
      }

      return instance.attributes;
    });

    await this.getAdapter().insert(this.getTable(), preparedRecords);
    return true;
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
  static async destroy(id: any | any[]): Promise<number> {
    const ids = Array.isArray(id) ? id : [id];
    let count = 0;

    for (const singleId of ids) {
      const instance = await this.find(singleId);
      if (instance && (await (instance as any).delete())) {
        count++;
      }
    }

    return count;
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
   * First or new (doesn't save)
   */
  static async firstOrNew<T>(
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

    const instance = new this() as any;
    instance.fill({ ...attributes, ...values });
    return instance as T;
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
   * Upsert records
   */
  static async upsert<T>(
    values: Partial<T>[],
    uniqueBy: string | string[],
    update?: string[]
  ): Promise<number> {
    const adapter = this.getAdapter() as any;

    if (typeof adapter.upsert === "function") {
      return await adapter.upsert(this.getTable(), values, uniqueBy, update);
    }

    // Fallback: updateOrCreate each record
    for (const record of values) {
      const keys = Array.isArray(uniqueBy) ? uniqueBy : [uniqueBy];
      const attributes: Record<string, any> = {};

      for (const key of keys) {
        attributes[key] = (record as any)[key];
      }

      await this.updateOrCreate<T>(attributes as Partial<T>, record);
    }

    return values.length;
  }

  /**
   * Truncate the table
   */
  static async truncate(): Promise<void> {
    const adapter = this.getAdapter() as any;
    if (typeof adapter.truncate === "function") {
      await adapter.truncate(this.getTable());
    } else {
      throw new Error("Truncate not supported by this adapter");
    }
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
   * Hydrate multiple model instances
   */
  protected static hydrateMany<T>(records: any[]): T[] {
    return records.map((record) => this.hydrate<T>(record));
  }

  /**
   * Create a new model instance without saving
   */
  static make<T>(attributes: Partial<T> = {}): T {
    const instance = new this() as any;
    instance.fill(attributes);
    return instance as T;
  }

  /**
   * Fill model attributes
   */
  fill(attributes: Partial<T>): this {
    for (const [key, value] of Object.entries(
      attributes as Record<string, any>
    )) {
      if (this.isFillable(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Force fill (ignore guarded)
   */
  forceFill(attributes: Partial<T>): this {
    for (const [key, value] of Object.entries(
      attributes as Record<string, any>
    )) {
      this.setAttribute(key, value);
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
    return !this.guarded.includes(key) && !this.guarded.includes("*");
  }

  /**
   * Check if model is totally guarded
   */
  protected totallyGuarded(): boolean {
    return this.fillable.length === 0 && this.guarded.includes("*");
  }

  /**
   * Set an attribute
   */
  setAttribute(key: string, value: any): this {
    // Check for mutator method
    const mutator = `set${this.studly(key)}Attribute`;
    if (typeof (this as any)[mutator] === "function") {
      value = (this as any)[mutator](value);
    }

    // Apply cast on set
    this.attributes[key] = this.castAttributeForSet(key, value);
    return this;
  }

  /**
   * Get an attribute
   */
  getAttribute(key: string): any {
    // First check if it's a relation that's been loaded
    if (this.relations[key] !== undefined) {
      return this.relations[key];
    }

    // Check for accessor method
    const accessor = `get${this.studly(key)}Attribute`;
    if (typeof (this as any)[accessor] === "function") {
      return (this as any)[accessor](this.attributes[key]);
    }

    // Get the raw value
    let value = this.attributes[key];

    // Apply cast on get
    value = this.castAttributeForGet(key, value);

    return value;
  }

  /**
   * Get raw attribute value (no casting or accessors)
   */
  getRawAttribute(key: string): any {
    return this.attributes[key];
  }

  /**
   * Get all raw attributes
   */
  getRawAttributes(): Record<string, any> {
    return { ...this.attributes };
  }

  /**
   * Check if an attribute exists
   */
  hasAttribute(key: string): boolean {
    return key in this.attributes;
  }

  /**
   * Cast attribute for getting (reading from database)
   */
  protected castAttributeForGet(key: string, value: any): any {
    if (value === null || value === undefined) return value;

    const cast = this.casts[key];
    if (!cast) {
      // Check if it's a date attribute
      if (this.dates.includes(key)) {
        return this.asDateTime(value);
      }
      return value;
    }

    // Handle custom casters
    if (typeof cast === "object" && "get" in cast) {
      return cast.get(value, key, this);
    }

    // Handle custom registered casters
    const customCast = (this.constructor as typeof Model).customCasts.get(
      cast as string
    );
    if (customCast) {
      return customCast.get(value, key, this);
    }

    const castType = typeof cast === "string" ? cast : String(cast);

    // Handle parameterized casts
    if (castType.startsWith("decimal:")) {
      const precision = parseInt(castType.split(":")[1]) || 2;
      return parseFloat(parseFloat(value).toFixed(precision));
    }

    if (castType.startsWith("date:") || castType.startsWith("datetime:")) {
      const format = castType.split(":")[1];
      return this.asDateTime(value, format);
    }

    if (castType.startsWith("enum:")) {
      return value; // Enums are stored as-is
    }

    switch (castType) {
      case "int":
      case "integer":
        return parseInt(value, 10);

      case "float":
      case "double":
      case "real":
        return parseFloat(value);

      case "decimal":
        return parseFloat(parseFloat(value).toFixed(2));

      case "string":
        return String(value);

      case "bool":
      case "boolean":
        if (typeof value === "string") {
          return value.toLowerCase() === "true" || value === "1";
        }
        return Boolean(value);

      case "array":
      case "json":
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;

      case "object":
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return {};
          }
        }
        return value || {};

      case "collection":
        const items = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(items) ? items : [];

      case "date":
      case "datetime":
      case "timestamp":
        return this.asDateTime(value);

      case "immutable_date":
      case "immutable_datetime":
        const date = this.asDateTime(value);
        return date ? Object.freeze(date) : null;

      case "encrypted":
        return this.decryptValue(value);

      case "hashed":
        return value; // Hashed values are not reversed

      case "objectId":
        if (typeof value === "string" && value.length === 24) {
          try {
            const mongodb = ModuleLoader.require("mongodb");
            if (mongodb && mongodb.ObjectId) {
              return new mongodb.ObjectId(value);
            }
          } catch (e) {
            console.error("Arcanox Model: Failed to cast to ObjectId", e);
          }
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Cast attribute for setting (writing to database)
   */
  protected castAttributeForSet(key: string, value: any): any {
    if (value === null || value === undefined) return value;

    const cast = this.casts[key];
    if (!cast) {
      // Check if it's a date attribute
      if (this.dates.includes(key)) {
        return this.fromDateTime(value);
      }
      return value;
    }

    // Handle custom casters
    if (typeof cast === "object" && "set" in cast) {
      return cast.set(value, key, this);
    }

    // Handle custom registered casters
    const customCast = (this.constructor as typeof Model).customCasts.get(
      cast as string
    );
    if (customCast) {
      return customCast.set(value, key, this);
    }

    const castType = typeof cast === "string" ? cast : String(cast);

    // Handle parameterized casts
    if (castType.startsWith("decimal:")) {
      const precision = parseInt(castType.split(":")[1]) || 2;
      return parseFloat(parseFloat(value).toFixed(precision));
    }

    if (castType.startsWith("enum:")) {
      const allowedValues = castType.split(":")[1].split(",");
      if (!allowedValues.includes(value)) {
        throw new Error(
          `Invalid enum value "${value}" for attribute "${key}". Allowed values: ${allowedValues.join(
            ", "
          )}`
        );
      }
      return value;
    }

    switch (castType) {
      case "array":
      case "json":
      case "object":
      case "collection":
        return typeof value === "object" ? JSON.stringify(value) : value;

      case "date":
      case "datetime":
      case "timestamp":
      case "immutable_date":
      case "immutable_datetime":
        return this.fromDateTime(value);

      case "encrypted":
        return this.encryptValue(value);

      case "hashed":
        return this.hashValue(value);

      case "objectId":
        if (typeof value === "string" && value.length === 24) {
          try {
            const mongodb = ModuleLoader.require("mongodb");
            if (mongodb && mongodb.ObjectId) {
              return new mongodb.ObjectId(value);
            }
          } catch (e) {
            console.error("Arcanox Model: Failed to cast to ObjectId", e);
          }
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Convert a value to DateTime
   */
  protected asDateTime(value: any, _format?: string): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;

    // Handle timestamps
    if (typeof value === "number") {
      return new Date(value);
    }

    // Handle string dates
    if (typeof value === "string") {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  /**
   * Convert DateTime to database format
   */
  protected fromDateTime(value: any): Date | string | null {
    if (!value) return null;
    if (value instanceof Date) return value;

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Encrypt a value (override in subclass for custom encryption)
   */
  protected encryptValue(value: any): string {
    // Basic base64 encoding - override for real encryption
    return Buffer.from(JSON.stringify(value)).toString("base64");
  }

  /**
   * Decrypt a value (override in subclass for custom decryption)
   */
  protected decryptValue(value: string): any {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    } catch {
      return value;
    }
  }

  /**
   * Hash a value (override in subclass for custom hashing)
   */
  protected hashValue(value: string): string {
    // This should be overridden with proper hashing (bcrypt, argon2, etc.)
    // Default implementation just returns the value as-is
    console.warn(
      "Model.hashValue should be overridden with proper hashing implementation"
    );
    return value;
  }

  /**
   * Cast attribute to specified type (legacy method for compatibility)
   */
  protected castAttribute(
    key: string,
    value: any,
    isGetting: boolean = false
  ): any {
    return isGetting
      ? this.castAttributeForGet(key, value)
      : this.castAttributeForSet(key, value);
  }

  /**
   * Save the model
   */
  async save(): Promise<this> {
    const constructor = this.constructor as typeof Model;
    const isUpdating = this.exists;

    // Fire saving hook
    const shouldSave = await ModelEventDispatcher.dispatch(
      constructor.name,
      "saving",
      this
    );
    if (shouldSave === false) {
      throw new Error("Model save was cancelled by saving hook");
    }

    // Fire creating/updating hook
    if (isUpdating) {
      const shouldUpdate = await ModelEventDispatcher.dispatch(
        constructor.name,
        "updating",
        this
      );
      if (shouldUpdate === false) {
        throw new Error("Model update was cancelled by updating hook");
      }
    } else {
      const shouldCreate = await ModelEventDispatcher.dispatch(
        constructor.name,
        "creating",
        this
      );
      if (shouldCreate === false) {
        throw new Error("Model creation was cancelled by creating hook");
      }
    }

    // Handle timestamps
    if (this.timestamps) {
      const now = new Date();
      if (!this.exists) {
        this.attributes[this.createdAt] = now;
      }
      this.attributes[this.updatedAt] = now;
    }

    // Store changes before saving
    this.changes = this.getDirty();

    if (this.exists) {
      // Update existing record
      const id = this.attributes[constructor.primaryKey];
      const dirtyAttributes = this.getDirty();

      if (Object.keys(dirtyAttributes).length > 0) {
        await constructor
          .getAdapter()
          .update(constructor.getTable(), id, dirtyAttributes);
      }
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
      this.wasRecentlyCreated = true;
    }

    this.syncOriginal();

    // Fire created/updated hook
    if (isUpdating) {
      await ModelEventDispatcher.dispatch(constructor.name, "updated", this);
    } else {
      await ModelEventDispatcher.dispatch(constructor.name, "created", this);
    }

    // Fire saved hook
    await ModelEventDispatcher.dispatch(constructor.name, "saved", this);

    // Touch parent relationships
    await this.touchOwners();

    return this;
  }

  /**
   * Save model without firing events
   */
  async saveQuietly(): Promise<this> {
    const constructor = this.constructor as typeof Model;

    if (this.timestamps) {
      const now = new Date();
      if (!this.exists) {
        this.attributes[this.createdAt] = now;
      }
      this.attributes[this.updatedAt] = now;
    }

    if (this.exists) {
      const id = this.attributes[constructor.primaryKey];
      const dirtyAttributes = this.getDirty();

      if (Object.keys(dirtyAttributes).length > 0) {
        await constructor
          .getAdapter()
          .update(constructor.getTable(), id, dirtyAttributes);
      }
    } else {
      const result = await constructor
        .getAdapter()
        .insert(constructor.getTable(), this.attributes);

      const id = result[constructor.primaryKey] || result.id || result.insertId;
      this.attributes[constructor.primaryKey] = id;
      if (constructor.primaryKey !== "id") {
        this.attributes.id = id;
      }

      this.exists = true;
      this.wasRecentlyCreated = true;
    }

    this.syncOriginal();
    return this;
  }

  /**
   * Touch parent relationships defined in touches array
   */
  protected async touchOwners(): Promise<void> {
    for (const relation of this.touches) {
      if (typeof (this as any)[relation] === "function") {
        const related = await (this as any)[relation]().getResults();
        if (related) {
          if (Array.isArray(related)) {
            for (const model of related) {
              await model.touch();
            }
          } else {
            await related.touch();
          }
        }
      }
    }
  }

  /**
   * Update the model's update timestamp
   */
  async touch(): Promise<boolean> {
    if (!this.timestamps) return false;

    this.attributes[this.updatedAt] = new Date();
    return await this.save().then(() => true);
  }

  /**
   * Update the model
   */
  async update(attributes: Partial<T>): Promise<this> {
    this.fill(attributes);
    return await this.save();
  }

  /**
   * Update without events
   */
  async updateQuietly(attributes: Partial<T>): Promise<this> {
    this.fill(attributes);
    return await this.saveQuietly();
  }

  /**
   * Delete the model
   */
  async delete(): Promise<boolean> {
    const constructor = this.constructor as typeof Model;

    // Fire deleting hook
    const shouldDelete = await ModelEventDispatcher.dispatch(
      constructor.name,
      "deleting",
      this
    );
    if (shouldDelete === false) {
      return false;
    }

    if (this.softDeletes) {
      this.attributes[this.deletedAt] = new Date();
      await this.save();

      // Fire deleted hook
      await ModelEventDispatcher.dispatch(constructor.name, "deleted", this);
      return true;
    }

    const id = this.attributes[constructor.primaryKey];
    const result = await constructor
      .getAdapter()
      .delete(constructor.getTable(), id);

    // Fire deleted hook
    await ModelEventDispatcher.dispatch(constructor.name, "deleted", this);

    this.exists = false;
    return result;
  }

  /**
   * Delete without events
   */
  async deleteQuietly(): Promise<boolean> {
    const constructor = this.constructor as typeof Model;

    if (this.softDeletes) {
      this.attributes[this.deletedAt] = new Date();
      await this.saveQuietly();
      return true;
    }

    const id = this.attributes[constructor.primaryKey];
    const result = await constructor
      .getAdapter()
      .delete(constructor.getTable(), id);
    this.exists = false;
    return result;
  }

  /**
   * Force delete (ignore soft deletes)
   */
  async forceDelete(): Promise<boolean> {
    const constructor = this.constructor as typeof Model;

    // Fire forceDeleting hook
    const shouldDelete = await ModelEventDispatcher.dispatch(
      constructor.name,
      "forceDeleting",
      this
    );
    if (shouldDelete === false) {
      return false;
    }

    const id = this.attributes[constructor.primaryKey];
    const result = await constructor
      .getAdapter()
      .delete(constructor.getTable(), id);

    // Fire forceDeleted hook
    await ModelEventDispatcher.dispatch(constructor.name, "forceDeleted", this);

    this.exists = false;
    return result;
  }

  /**
   * Restore soft deleted model
   */
  async restore(): Promise<this> {
    if (!this.softDeletes) return this;

    // Fire restoring hook
    const constructor = this.constructor as typeof Model;
    const shouldRestore = await ModelEventDispatcher.dispatch(
      constructor.name,
      "restoring",
      this
    );
    if (shouldRestore === false) {
      throw new Error("Model restore was cancelled by restoring hook");
    }

    this.attributes[this.deletedAt] = null;
    await this.save();

    // Fire restored hook
    await ModelEventDispatcher.dispatch(constructor.name, "restored", this);

    return this;
  }

  /**
   * Check if model has been soft deleted
   */
  trashed(): boolean {
    return this.softDeletes && this.attributes[this.deletedAt] != null;
  }

  /**
   * Sync original attributes
   */
  protected syncOriginal(): void {
    this.original = { ...this.attributes };
    this.changes = {};
  }

  /**
   * Get dirty attributes (changed since last sync)
   */
  getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (!this.originalIsEquivalent(key, value)) {
        dirty[key] = value;
      }
    }
    return dirty;
  }

  /**
   * Check if original value is equivalent to current
   */
  protected originalIsEquivalent(key: string, value: any): boolean {
    if (!Object.prototype.hasOwnProperty.call(this.original, key)) {
      return false;
    }

    const original = this.original[key];

    if (value === original) return true;

    // Handle date comparison
    if (value instanceof Date && original instanceof Date) {
      return value.getTime() === original.getTime();
    }

    // Handle object/array comparison
    if (typeof value === "object" && typeof original === "object") {
      return JSON.stringify(value) === JSON.stringify(original);
    }

    return false;
  }

  /**
   * Check if model is dirty
   */
  isDirty(attributes?: string | string[]): boolean {
    const dirty = this.getDirty();

    if (!attributes) {
      return Object.keys(dirty).length > 0;
    }

    const attrs = Array.isArray(attributes) ? attributes : [attributes];
    return attrs.some((attr) => attr in dirty);
  }

  /**
   * Check if model is clean (not dirty)
   */
  isClean(attributes?: string | string[]): boolean {
    return !this.isDirty(attributes);
  }

  /**
   * Get changed attributes
   */
  getChanges(): Record<string, any> {
    return { ...this.changes };
  }

  /**
   * Check if attribute was changed
   */
  wasChanged(attributes?: string | string[]): boolean {
    if (!attributes) {
      return Object.keys(this.changes).length > 0;
    }

    const attrs = Array.isArray(attributes) ? attributes : [attributes];
    return attrs.some((attr) => attr in this.changes);
  }

  /**
   * Get original attribute value
   */
  getOriginal(key?: string): any {
    if (!key) {
      return { ...this.original };
    }
    return this.original[key];
  }

  /**
   * Check if model was recently created
   */
  wasRecentlyCreatedMethod(): boolean {
    return this.wasRecentlyCreated;
  }

  constructor(attributes: Partial<T> = {}) {
    super();
    (this.constructor as typeof Model).bootIfNotBooted();
    this.fill(attributes);
  }

  /**
   * Create a new instance from existing attributes
   */
  newInstance(
    attributes: Record<string, any> = {},
    exists: boolean = false
  ): this {
    const constructor = this.constructor as typeof Model;
    const instance = new constructor(attributes) as this;
    (instance as any).exists = exists;
    (instance as any).original = { ...attributes };
    return instance;
  }

  /**
   * Create a fresh instance from the database
   */
  async fresh(columns: string[] = ["*"]): Promise<this | null> {
    const constructor = this.constructor as typeof Model;
    if (!this.exists) return null;

    const id = this.attributes[constructor.primaryKey];
    const query = constructor.query().where(constructor.primaryKey, id);

    if (columns[0] !== "*") {
      query.select(...columns);
    }

    const result = await query.first();
    return result ? constructor.hydrate<this>(result) : null;
  }

  /**
   * Reload the model from the database
   */
  async refresh(): Promise<this> {
    const constructor = this.constructor as typeof Model;
    if (!this.exists) return this;

    const id = this.attributes[constructor.primaryKey];
    const result = await constructor
      .query()
      .where(constructor.primaryKey, id)
      .first();

    if (result) {
      this.attributes = result as Record<string, any>;
      this.original = { ...this.attributes };
      this.relations = {};
    }

    return this;
  }

  /**
   * Clone the model instance
   */
  replicate(except: string[] = []): this {
    const constructor = this.constructor as typeof Model;
    const defaults = [constructor.primaryKey, this.createdAt, this.updatedAt];
    const exceptAll = [...defaults, ...except];

    const attributes: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (!exceptAll.includes(key)) {
        attributes[key] = value;
      }
    }

    return this.newInstance(attributes, false);
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

    // Add appended attributes (computed/accessor attributes)
    for (const key of this.appends) {
      const accessor = `get${this.studly(key)}Attribute`;
      if (typeof (this as any)[accessor] === "function") {
        json[key] = (this as any)[accessor]();
      }
    }

    // Add relations
    for (const [key, value] of Object.entries(this.relations)) {
      if (this.hidden.includes(key)) continue;
      if (this.visible.length > 0 && !this.visible.includes(key)) continue;

      if (Array.isArray(value)) {
        json[key] = value.map((v) =>
          v && typeof v.toJSON === "function" ? v.toJSON() : v
        );
      } else if (value && typeof value.toJSON === "function") {
        json[key] = value.toJSON();
      } else {
        json[key] = value;
      }
    }

    return json;
  }

  /**
   * Convert model to array (alias for toJSON)
   */
  toArray(): Record<string, any> {
    return this.toJSON();
  }

  /**
   * Convert model to string
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Set hidden attributes for serialization
   */
  makeHidden(...attributes: string[]): this {
    this.hidden = [...new Set([...this.hidden, ...attributes])];
    return this;
  }

  /**
   * Set visible attributes for serialization
   */
  makeVisible(...attributes: string[]): this {
    this.hidden = this.hidden.filter((h) => !attributes.includes(h));
    if (this.visible.length > 0) {
      this.visible = [...new Set([...this.visible, ...attributes])];
    }
    return this;
  }

  /**
   * Append accessors to the model
   */
  append(...attributes: string[]): this {
    this.appends = [...new Set([...this.appends, ...attributes])];
    return this;
  }

  /**
   * Set appends (replacing existing)
   */
  setAppends(attributes: string[]): this {
    this.appends = attributes;
    return this;
  }

  /**
   * Get only specified attributes
   */
  only(...attributes: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const attr of attributes) {
      result[attr] = this.getAttribute(attr);
    }
    return result;
  }

  /**
   * Get all attributes except specified ones
   */
  except(...attributes: string[]): Record<string, any> {
    const result = this.toJSON();
    for (const attr of attributes) {
      delete result[attr];
    }
    return result;
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
   * Create a new query without global scopes
   */
  newQueryWithoutScopes(): QueryBuilder<T> {
    return (this.constructor as typeof Model).withoutGlobalScopes<T>();
  }

  /**
   * Load a relationship
   */
  async load(relations: string | string[]): Promise<this> {
    const relationsArray = Array.isArray(relations) ? relations : [relations];

    for (const relation of relationsArray) {
      if (typeof (this as any)[relation] === "function") {
        const relationInstance = (this as any)[relation]();
        const result = await relationInstance.getResults();
        this.setRelation(relation, result);
      }
    }

    return this;
  }

  /**
   * Load missing relationships (only load if not already loaded)
   */
  async loadMissing(relations: string | string[]): Promise<this> {
    const relationsArray = Array.isArray(relations) ? relations : [relations];
    const missing = relationsArray.filter((r) => !this.relationLoaded(r));

    if (missing.length > 0) {
      await this.load(missing);
    }

    return this;
  }

  /**
   * Unset a loaded relationship
   */
  unsetRelation(relation: string): this {
    delete this.relations[relation];
    return this;
  }

  /**
   * Unset all loaded relationships
   */
  unsetRelations(): this {
    this.relations = {};
    return this;
  }

  /**
   * Get all loaded relations
   */
  getRelations(): Record<string, any> {
    return { ...this.relations };
  }

  /**
   * Check equality with another model
   */
  is(model: Model | null): boolean {
    if (!model) return false;

    const constructor = this.constructor as typeof Model;
    const otherConstructor = model.constructor as typeof Model;

    return (
      constructor.name === otherConstructor.name &&
      this.id === model.id &&
      constructor.getTable() === otherConstructor.getTable()
    );
  }

  /**
   * Check inequality with another model
   */
  isNot(model: Model | null): boolean {
    return !this.is(model);
  }

  /**
   * Static: Get count of records
   */
  static async count<T>(column: string = "*"): Promise<number> {
    const result = await this.query<T>().count(column);
    return result as number;
  }

  /**
   * Static: Get max value
   */
  static async max<T>(column: string): Promise<number> {
    return await this.query<T>().max(column);
  }

  /**
   * Static: Get min value
   */
  static async min<T>(column: string): Promise<number> {
    return await this.query<T>().min(column);
  }

  /**
   * Static: Get sum value
   */
  static async sum<T>(column: string): Promise<number> {
    return await this.query<T>().sum(column);
  }

  /**
   * Static: Get average value
   */
  static async avg<T>(column: string): Promise<number> {
    return await this.query<T>().avg(column);
  }

  /**
   * Static: Check if any records exist
   */
  static async exists<T>(): Promise<boolean> {
    return await this.query<T>().exists();
  }

  /**
   * Static: Check if no records exist
   */
  static async doesntExist<T>(): Promise<boolean> {
    return await this.query<T>().doesntExist();
  }

  /**
   * Static: Get first record or fail
   */
  static async firstOrFail<T>(): Promise<T> {
    const result = await this.query<T>().first();
    if (!result) {
      throw new ModelNotFoundException("No query results for model", this.name);
    }
    return this.hydrate<T>(result);
  }

  /**
   * Static: Get first record or create new
   */
  static async sole<T>(): Promise<T> {
    const results = await this.query<T>().limit(2).get();

    if (results.length === 0) {
      throw new ModelNotFoundException("No query results for model", this.name);
    }

    if (results.length > 1) {
      throw new Error("Multiple records found when expecting exactly one");
    }

    return this.hydrate<T>(results[0]);
  }

  /**
   * Static: Paginate results
   */
  static async paginate<T>(
    perPage: number = 15,
    page: number = 1
  ): Promise<{
    data: T[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    from: number | null;
    to: number | null;
  }> {
    return await this.query<T>().paginate(perPage, page);
  }

  /**
   * Static: Simple pagination (without total count)
   */
  static async simplePaginate<T>(
    perPage: number = 15,
    page: number = 1
  ): Promise<{
    data: T[];
    perPage: number;
    currentPage: number;
    hasMore: boolean;
  }> {
    const query = this.query<T>();
    const results = await query
      .skip((page - 1) * perPage)
      .take(perPage + 1)
      .get();
    const hasMore = results.length > perPage;

    return {
      data: hasMore ? results.slice(0, perPage) : results,
      perPage,
      currentPage: page,
      hasMore,
    };
  }

  /**
   * Static: Cursor pagination
   */
  static async cursorPaginate<T>(
    perPage: number = 15,
    cursor?: string,
    cursorColumn: string = "id"
  ): Promise<{
    data: T[];
    perPage: number;
    nextCursor: string | null;
    previousCursor: string | null;
  }> {
    const query = this.query<T>();

    if (cursor) {
      query.where(cursorColumn, ">", cursor);
    }

    const results = await query
      .orderBy(cursorColumn, "asc")
      .take(perPage + 1)
      .get();
    const hasMore = results.length > perPage;
    const data = hasMore ? results.slice(0, perPage) : results;

    return {
      data,
      perPage,
      nextCursor:
        hasMore && data.length > 0
          ? String((data[data.length - 1] as any)[cursorColumn])
          : null,
      previousCursor: cursor || null,
    };
  }

  /**
   * Static: Process records in chunks
   */
  static async chunk<T>(
    count: number,
    callback: (
      items: T[],
      page: number
    ) => boolean | void | Promise<boolean | void>
  ): Promise<boolean> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const results = await this.query<T>()
        .skip((page - 1) * count)
        .take(count)
        .get();

      if (results.length === 0) {
        break;
      }

      const shouldContinue = await callback(results, page);

      if (shouldContinue === false) {
        return false;
      }

      hasMore = results.length === count;
      page++;
    }

    return true;
  }

  /**
   * Static: Process each record
   */
  static async each<T>(
    callback: (
      item: T,
      index: number
    ) => boolean | void | Promise<boolean | void>,
    count: number = 1000
  ): Promise<boolean> {
    let index = 0;

    return await this.chunk<T>(count, async (items) => {
      for (const item of items) {
        const result = await callback(item, index++);
        if (result === false) {
          return false;
        }
      }
    });
  }

  /**
   * Static: Lazy iteration using async generator
   */
  static async *lazyIterator<T>(
    chunkSize: number = 1000
  ): AsyncGenerator<T, void, unknown> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const results = await this.query<T>()
        .skip((page - 1) * chunkSize)
        .take(chunkSize)
        .get();

      if (results.length === 0) {
        break;
      }

      for (const item of results) {
        yield item;
      }

      hasMore = results.length === chunkSize;
      page++;
    }
  }

  /**
   * Static: Get plucked values
   */
  static async pluck<T>(
    column: string,
    key?: string
  ): Promise<any[] | Record<string, any>> {
    const results = await this.query<T>().get();

    if (key) {
      const plucked: Record<string, any> = {};
      for (const item of results) {
        const itemObj = item as Record<string, any>;
        plucked[itemObj[key]] = itemObj[column];
      }
      return plucked;
    }

    return results.map((item: any) => item[column]);
  }

  /**
   * Static: Order by column
   */
  static orderBy<T>(
    column: string,
    direction: "asc" | "desc" = "asc"
  ): QueryBuilder<T> {
    return this.query<T>().orderBy(column, direction);
  }

  /**
   * Static: Latest records (ordered by created_at desc)
   */
  static latest<T>(column?: string): QueryBuilder<T> {
    const instance = new this();
    return this.query<T>().orderBy(
      column || (instance as any).createdAt || "created_at",
      "desc"
    );
  }

  /**
   * Static: Oldest records (ordered by created_at asc)
   */
  static oldest<T>(column?: string): QueryBuilder<T> {
    const instance = new this();
    return this.query<T>().orderBy(
      column || (instance as any).createdAt || "created_at",
      "asc"
    );
  }

  /**
   * Static: Include trashed records (soft deletes)
   */
  static withTrashed<T>(): QueryBuilder<T> {
    return this.withoutGlobalScope<T>("soft_delete");
  }

  /**
   * Static: Only trashed records (soft deletes)
   */
  static onlyTrashed<T>(): QueryBuilder<T> {
    const instance = new this() as any;
    return this.withoutGlobalScope<T>("soft_delete").whereNotNull(
      instance.deletedAt || "deleted_at"
    );
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

  /**
   * Helper: Convert to camelCase
   */
  protected camel(str: string): string {
    if (!str) return str;
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  /**
   * Helper: Convert to snake_case (instance method)
   */
  protected snake(str: string): string {
    return (this.constructor as typeof Model).snakeCase(str);
  }
}
