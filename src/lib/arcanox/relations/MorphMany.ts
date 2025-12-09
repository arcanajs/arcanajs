import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

/**
 * MorphMany Relationship
 * Defines a polymorphic one-to-many relationship
 */
export class MorphMany<R extends Model = any> extends Relation<R> {
  protected morphType: string;
  protected morphClass: string;
  protected foreignKey: string;
  protected localKey: string;

  constructor(
    query: QueryBuilder<R>,
    parent: Model,
    morphType: string,
    foreignKey: string,
    localKey: string = "id"
  ) {
    super(query, parent);
    this.morphType = morphType;
    this.foreignKey = foreignKey;
    this.localKey = localKey;
    this.morphClass = (parent.constructor as typeof Model).getTable();
  }

  /**
   * Set the morph class name
   */
  setMorphClass(morphClass: string): this {
    this.morphClass = morphClass;
    return this;
  }

  /**
   * Add the base constraints for the relation
   */
  addConstraints(): void {
    const localValue = this.parent.getAttribute(this.localKey);

    this.query.where(this.morphType, "=", this.morphClass);
    this.query.where(this.foreignKey, "=", localValue);
  }

  /**
   * Add eager loading constraints for multiple models
   */
  addEagerConstraints(models: Model[]): void {
    const keys = models
      .map((model) => model.getAttribute(this.localKey))
      .filter((k) => k !== null && k !== undefined);

    this.query.where(this.morphType, "=", this.morphClass);
    this.query.whereIn(this.foreignKey, keys);
  }

  /**
   * Match eagerly loaded results to their parent models
   */
  match(models: Model[], results: R[], relation: string): Model[] {
    const dictionary: Record<string, R[]> = {};

    for (const result of results) {
      const key = this.normalizeKey(result.getAttribute(this.foreignKey));
      if (!dictionary[key]) {
        dictionary[key] = [];
      }
      dictionary[key].push(result);
    }

    for (const model of models) {
      const key = this.normalizeKey(model.getAttribute(this.localKey));
      model.setRelation(relation, dictionary[key] || []);
    }

    return models;
  }

  /**
   * Get the results of the relationship
   */
  async getResults(): Promise<R[]> {
    return this.get();
  }

  /**
   * Get the morph type column name
   */
  getMorphType(): string {
    return this.morphType;
  }

  /**
   * Get the morph class name
   */
  getMorphClass(): string {
    return this.morphClass;
  }

  /**
   * Get the foreign key name
   */
  getForeignKeyName(): string {
    return this.foreignKey;
  }

  /**
   * Get the local key name
   */
  getLocalKeyName(): string {
    return this.localKey;
  }

  /**
   * Get the qualified foreign key name
   */
  getQualifiedForeignKeyName(): string {
    const relatedTable = (
      this.related.prototype.constructor as typeof Model
    ).getTable();
    return `${relatedTable}.${this.foreignKey}`;
  }

  /**
   * Get the qualified morph type name
   */
  getQualifiedMorphType(): string {
    const relatedTable = (
      this.related.prototype.constructor as typeof Model
    ).getTable();
    return `${relatedTable}.${this.morphType}`;
  }

  /**
   * Set the foreign attributes for creating a new model
   */
  protected setForeignAttributesForCreate(model: R): void {
    (model as any).setAttribute(this.morphType, this.morphClass);
    (model as any).setAttribute(
      this.foreignKey,
      this.parent.getAttribute(this.localKey)
    );
  }

  /**
   * Save a new model and attach it to the parent
   */
  async save(model: R): Promise<R> {
    this.setForeignAttributesForCreate(model);
    await (model as any).save();
    return model;
  }

  /**
   * Save multiple new models
   */
  async saveMany(models: R[]): Promise<R[]> {
    const saved: R[] = [];
    for (const model of models) {
      saved.push(await this.save(model));
    }
    return saved;
  }

  /**
   * Create a new model instance without saving
   */
  make(attributes: Record<string, any> = {}): R {
    const instance = new this.related();
    (instance as any).fill(attributes);
    this.setForeignAttributesForCreate(instance);
    return instance;
  }

  /**
   * Create multiple new model instances without saving
   */
  makeMany(records: Record<string, any>[]): R[] {
    return records.map((record) => this.make(record));
  }

  /**
   * Find a specific model in the relationship
   */
  async findInRelation(id: any): Promise<R | null> {
    return this.where("id", id).first();
  }

  /**
   * Update or create a related model
   */
  async updateOrCreate(
    attributes: Record<string, any>,
    values: Record<string, any> = {}
  ): Promise<R> {
    const query = this.getQuery().clone();

    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }

    const existing = await query.first();

    if (existing) {
      await (existing as any).update(values);
      return existing;
    }

    return this.create({ ...attributes, ...values });
  }

  /**
   * Get the first related model or create a new one
   */
  async firstOrCreate(
    attributes: Record<string, any>,
    values: Record<string, any> = {}
  ): Promise<R> {
    const query = this.getQuery().clone();

    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }

    const existing = await query.first();

    if (existing) {
      return existing;
    }

    return this.create({ ...attributes, ...values });
  }

  /**
   * Get the first related model or return a new instance
   */
  async firstOrNew(
    attributes: Record<string, any>,
    values: Record<string, any> = {}
  ): Promise<R> {
    const query = this.getQuery().clone();

    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }

    const existing = await query.first();

    if (existing) {
      return existing;
    }

    return this.make({ ...attributes, ...values });
  }

  /**
   * Get the latest related model
   */
  async latest(column?: string): Promise<R | null> {
    return this.orderBy(column || "created_at", "desc").first();
  }

  /**
   * Get the oldest related model
   */
  async oldest(column?: string): Promise<R | null> {
    return this.orderBy(column || "created_at", "asc").first();
  }

  /**
   * Paginate the related models
   */
  async paginate(perPage: number = 15, page: number = 1) {
    const total = await this.count();
    const results = await this.skip((page - 1) * perPage)
      .take(perPage)
      .get();
    const lastPage = Math.ceil(total / perPage);

    return {
      data: results,
      total,
      perPage,
      currentPage: page,
      lastPage,
      from: results.length > 0 ? (page - 1) * perPage + 1 : null,
      to: results.length > 0 ? (page - 1) * perPage + results.length : null,
    };
  }

  /**
   * Add a constraint for existence queries
   */
  getRelationExistenceQuery(
    query: QueryBuilder<R>,
    parentQuery: QueryBuilder<any>,
    _columns: string[] = ["*"]
  ): QueryBuilder<R> {
    const parentTable = (this.parent.constructor as typeof Model).getTable();

    query.where(this.morphType, "=", this.morphClass);
    query.whereColumn(
      `${query.getTable()}.${this.foreignKey}`,
      "=",
      `${parentTable}.${this.localKey}`
    );

    return query;
  }
}
