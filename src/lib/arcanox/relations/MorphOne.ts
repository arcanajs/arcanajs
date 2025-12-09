import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

/**
 * MorphOne Relationship
 * Defines a polymorphic one-to-one relationship
 */
export class MorphOne<R extends Model = any> extends Relation<R> {
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
    const dictionary: Record<string, R> = {};

    for (const result of results) {
      const key = this.normalizeKey(result.getAttribute(this.foreignKey));
      dictionary[key] = result;
    }

    for (const model of models) {
      const key = this.normalizeKey(model.getAttribute(this.localKey));
      const related = dictionary[key] || this.getDefaultFor(model);
      model.setRelation(relation, related);
    }

    return models;
  }

  /**
   * Get the results of the relationship
   */
  async getResults(): Promise<R | null> {
    const result = await this.first();
    return result || this.getDefaultFor(this.parent);
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
   * Create a new model instance without saving
   */
  make(attributes: Record<string, any> = {}): R {
    const instance = new this.related();
    (instance as any).fill(attributes);
    this.setForeignAttributesForCreate(instance);
    return instance;
  }

  /**
   * Update or create the related model
   */
  async updateOrCreate(
    attributes: Record<string, any>,
    values: Record<string, any> = {}
  ): Promise<R> {
    const existing = await this.first();

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
    const existing = await this.where(
      Object.keys(attributes)[0],
      Object.values(attributes)[0]
    ).first();

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
    const existing = await this.where(
      Object.keys(attributes)[0],
      Object.values(attributes)[0]
    ).first();

    if (existing) {
      return existing;
    }

    return this.make({ ...attributes, ...values });
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
