import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";

/**
 * Relation constraint callback type
 */
export type RelationConstraintCallback<R extends Model = any> = (
  query: QueryBuilder<R>
) => void;

/**
 * Base Relation class for all relationship types
 * Provides common functionality for eager loading, querying, and matching results
 */
export abstract class Relation<R extends Model = any> {
  protected query: QueryBuilder<R>;
  protected parent: Model;
  protected related: new () => R;
  protected constraints: RelationConstraintCallback<R>[] = [];
  protected withDefault: boolean | Record<string, any> = false;
  protected morphClass: string | null = null;

  constructor(query: QueryBuilder<R>, parent: Model) {
    this.query = query;
    this.parent = parent;
    this.related = (query as any).model;

    // Avoid applying constraints when the parent has no attributes (e.g. eager
    // loading constructs a fresh instance only to discover relation metadata).
    // Lazy-loaded relations still receive constraints because the parent will
    // have its attributes populated.
    const parentHasAttributes =
      this.parent &&
      Object.keys((this.parent as any).attributes || {}).length > 0;

    if (parentHasAttributes) {
      this.addConstraints();
    }
  }

  /**
   * Add the base constraints for the relation
   */
  abstract addConstraints(): void;

  /**
   * Add eager loading constraints for multiple models
   */
  abstract addEagerConstraints(models: Model[]): void;

  /**
   * Match eagerly loaded results to their parent models
   */
  abstract match(models: Model[], results: R[], relation: string): Model[];

  /**
   * Get the underlying query builder
   */
  getQuery(): QueryBuilder<R> {
    return this.query;
  }

  /**
   * Get the related model instance
   */
  getRelated(): R {
    return new this.related();
  }

  /**
   * Get the parent model
   */
  getParent(): Model {
    return this.parent;
  }

  /**
   * Get all results from the relation
   */
  async get(): Promise<R[]> {
    return this.query.get();
  }

  /**
   * Get the first result from the relation
   */
  async first(): Promise<R | null> {
    return this.query.first();
  }

  /**
   * Get the results of the relationship
   */
  async getResults(): Promise<R | R[] | null> {
    return this.get();
  }

  /**
   * Execute the query and get the result
   */
  async find(id: any): Promise<R | null> {
    return this.query.where("id", id).first();
  }

  /**
   * Find multiple models by their primary keys
   */
  async findMany(ids: any[]): Promise<R[]> {
    return this.query.whereIn("id", ids).get();
  }

  /**
   * Find a model by its primary key or throw an exception
   */
  async findOrFail(id: any): Promise<R> {
    const result = await this.find(id);
    if (!result) {
      throw new Error(`Model not found with id: ${id}`);
    }
    return result;
  }

  /**
   * Get the first result or throw an exception
   */
  async firstOrFail(): Promise<R> {
    const result = await this.first();
    if (!result) {
      throw new Error("No results found for relation");
    }
    return result;
  }

  /**
   * Get a count of related models
   */
  async count(): Promise<number> {
    return this.query.count();
  }

  /**
   * Check if any related models exist
   */
  async exists(): Promise<boolean> {
    return this.query.exists();
  }

  /**
   * Check if no related models exist
   */
  async doesntExist(): Promise<boolean> {
    return this.query.doesntExist();
  }

  /**
   * Get the sum of a column
   */
  async sum(column: string): Promise<number> {
    return this.query.sum(column);
  }

  /**
   * Get the average of a column
   */
  async avg(column: string): Promise<number> {
    return this.query.avg(column);
  }

  /**
   * Get the minimum value of a column
   */
  async min(column: string): Promise<number> {
    return this.query.min(column);
  }

  /**
   * Get the maximum value of a column
   */
  async max(column: string): Promise<number> {
    return this.query.max(column);
  }

  /**
   * Add a where clause to the query
   */
  where(column: string, operator?: any, value?: any): this {
    this.query.where(column, operator, value);
    return this;
  }

  /**
   * Add a where in clause to the query
   */
  whereIn(column: string, values: any[]): this {
    this.query.whereIn(column, values);
    return this;
  }

  /**
   * Add a where not in clause to the query
   */
  whereNotIn(column: string, values: any[]): this {
    this.query.whereNotIn(column, values);
    return this;
  }

  /**
   * Add a where null clause to the query
   */
  whereNull(column: string): this {
    this.query.whereNull(column);
    return this;
  }

  /**
   * Add a where not null clause to the query
   */
  whereNotNull(column: string): this {
    this.query.whereNotNull(column);
    return this;
  }

  /**
   * Add an order by clause to the query
   */
  orderBy(column: string, direction: "asc" | "desc" = "asc"): this {
    this.query.orderBy(column, direction);
    return this;
  }

  /**
   * Set the limit for the query
   */
  limit(limit: number): this {
    this.query.limit(limit);
    return this;
  }

  /**
   * Skip a number of results
   */
  skip(offset: number): this {
    this.query.offset(offset);
    return this;
  }

  /**
   * Take a number of results
   */
  take(limit: number): this {
    return this.limit(limit);
  }

  /**
   * Set the offset for the query
   */
  offset(offset: number): this {
    this.query.offset(offset);
    return this;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.query.select(...columns);
    return this;
  }

  /**
   * Add a custom constraint to the relation
   */
  constrain(callback: RelationConstraintCallback<R>): this {
    callback(this.query);
    this.constraints.push(callback);
    return this;
  }

  /**
   * Set a default model for the relation
   */
  withDefaultModel(callback?: boolean | Record<string, any>): this {
    this.withDefault = callback === undefined ? true : callback;
    return this;
  }

  /**
   * Get the default model for the relation (if set)
   */
  protected getDefaultFor(_parent: Model): R | null {
    if (!this.withDefault) {
      return null;
    }

    const instance = new this.related();

    if (typeof this.withDefault === "object") {
      (instance as any).forceFill(this.withDefault);
    }

    return instance;
  }

  /**
   * Create a new related model
   */
  async create(attributes: Record<string, any>): Promise<R> {
    const instance = new this.related();
    (instance as any).fill(attributes);
    this.setForeignAttributesForCreate(instance);
    await (instance as any).save();
    return instance;
  }

  /**
   * Create multiple new related models
   */
  async createMany(records: Record<string, any>[]): Promise<R[]> {
    const instances: R[] = [];
    for (const record of records) {
      instances.push(await this.create(record));
    }
    return instances;
  }

  /**
   * Set the foreign key attributes for a create operation (override in subclasses)
   */
  protected setForeignAttributesForCreate(_model: R): void {
    // Override in subclasses
  }

  /**
   * Update all related models
   */
  async update(attributes: Partial<R>): Promise<number> {
    return this.query.update(attributes);
  }

  /**
   * Delete all related models
   */
  async delete(): Promise<number> {
    const results = await this.get();
    let count = 0;
    for (const result of results) {
      await (result as any).delete();
      count++;
    }
    return count;
  }

  /**
   * Normalize a key value for comparison
   * Handles ObjectId, arrays, and other special types
   */
  protected normalizeKey(key: any): string {
    if (key === null || key === undefined) return "";

    if (Array.isArray(key)) {
      return key.map((item: any) => this.normalizeKey(item)).join("|");
    }

    if (typeof key === "object") {
      const candidate = key as {
        toHexString?: () => string;
        toString?: () => string;
        _id?: any;
      };

      if (candidate._id !== undefined) {
        return this.normalizeKey(candidate._id);
      }

      if (typeof candidate.toHexString === "function") {
        return candidate.toHexString();
      }

      if (typeof candidate.toString === "function") {
        return candidate.toString();
      }
    }

    return String(key);
  }

  /**
   * Build a dictionary of models keyed by a given attribute
   */
  protected buildDictionary(
    models: Model[],
    key: string
  ): Record<string, Model[]> {
    const dictionary: Record<string, Model[]> = {};

    for (const model of models) {
      const normalizedKey = this.normalizeKey(model.getAttribute(key));
      if (!dictionary[normalizedKey]) {
        dictionary[normalizedKey] = [];
      }
      dictionary[normalizedKey].push(model);
    }

    return dictionary;
  }

  /**
   * Get the morph class for polymorphic relations
   */
  getMorphClass(): string {
    if (this.morphClass) {
      return this.morphClass;
    }
    return (this.parent.constructor as typeof Model).getTable();
  }

  /**
   * Set the morph class for polymorphic relations
   */
  setMorphClass(morphClass: string): this {
    this.morphClass = morphClass;
    return this;
  }

  /**
   * Get the qualified foreign key
   */
  getQualifiedForeignKeyName(): string {
    // Override in subclasses
    return "";
  }

  /**
   * Get the fully qualified parent key name
   */
  getQualifiedParentKeyName(): string {
    // Override in subclasses
    return "";
  }

  /**
   * Clone the relation with the given parent
   */
  cloneWithParent(parent: Model): Relation<R> {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.parent = parent;
    clone.query = this.query.clone();
    return clone;
  }

  /**
   * Execute a callback with custom constraints
   */
  async tap(callback: (relation: this) => void | Promise<void>): Promise<this> {
    await callback(this);
    return this;
  }

  /**
   * Chunk through the related models
   */
  async chunk(
    count: number,
    callback: (
      models: R[],
      page: number
    ) => boolean | void | Promise<boolean | void>
  ): Promise<boolean> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const results = await this.query
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
   * Lazy iterate through the related models
   */
  async *lazy(chunkSize: number = 1000): AsyncGenerator<R, void, unknown> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const results = await this.query
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
}
