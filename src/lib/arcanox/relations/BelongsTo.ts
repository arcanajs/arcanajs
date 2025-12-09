import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

/**
 * BelongsTo Relationship
 * Defines an inverse one-to-one or many relationship where the current model contains the foreign key
 */
export class BelongsTo<R extends Model = any> extends Relation<R> {
  protected foreignKey: string;
  protected ownerKey: string;
  protected relationName: string | null = null;

  constructor(
    query: QueryBuilder<R>,
    parent: Model,
    foreignKey: string,
    ownerKey: string
  ) {
    super(query, parent);
    this.foreignKey = foreignKey;
    this.ownerKey = ownerKey;
  }

  /**
   * Add the base constraints for the relation
   */
  addConstraints(): void {
    const foreignValue = this.parent.getAttribute(this.foreignKey);
    this.query.where(this.ownerKey, "=", foreignValue);
  }

  /**
   * Add eager loading constraints for multiple models
   */
  addEagerConstraints(models: Model[]): void {
    const keys = models
      .map((model) => model.getAttribute(this.foreignKey))
      .filter((k) => k !== null && k !== undefined);
    this.query.whereIn(this.ownerKey, keys);
  }

  /**
   * Match eagerly loaded results to their parent models
   */
  match(models: Model[], results: R[], relation: string): Model[] {
    const dictionary: Record<string, R> = {};

    results.forEach((result) => {
      const key = this.normalizeKey(result.getAttribute(this.ownerKey));
      dictionary[key] = result;
    });

    models.forEach((model) => {
      const key = this.normalizeKey(model.getAttribute(this.foreignKey));
      const related = dictionary[key] || this.getDefaultFor(model);
      model.setRelation(relation, related);
    });

    return models;
  }

  /**
   * Get the results of the relationship
   */
  async getResults(): Promise<R | null> {
    const foreignValue = this.parent.getAttribute(this.foreignKey);

    // If the foreign key is null, return the default or null
    if (foreignValue === null || foreignValue === undefined) {
      return this.getDefaultFor(this.parent);
    }

    const result = await this.first();
    return result || this.getDefaultFor(this.parent);
  }

  /**
   * Get the foreign key name
   */
  getForeignKeyName(): string {
    return this.foreignKey;
  }

  /**
   * Get the owner key name
   */
  getOwnerKeyName(): string {
    return this.ownerKey;
  }

  /**
   * Get the qualified foreign key name
   */
  getQualifiedForeignKeyName(): string {
    const parentTable = (this.parent.constructor as typeof Model).getTable();
    return `${parentTable}.${this.foreignKey}`;
  }

  /**
   * Get the qualified owner key name
   */
  getQualifiedOwnerKeyName(): string {
    const relatedTable = (
      this.related.prototype.constructor as typeof Model
    ).getTable();
    return `${relatedTable}.${this.ownerKey}`;
  }

  /**
   * Associate the model with the given parent
   */
  associate(model: R | any): Model {
    const ownerKey =
      model instanceof Model ? model.getAttribute(this.ownerKey) : model;

    (this.parent as any).setAttribute(this.foreignKey, ownerKey);

    if (model instanceof Model) {
      this.parent.setRelation(this.getRelationName(), model);
    }

    return this.parent;
  }

  /**
   * Dissociate the model from the parent (set foreign key to null)
   */
  dissociate(): Model {
    (this.parent as any).setAttribute(this.foreignKey, null);

    return this.parent.setRelation(this.getRelationName(), null);
  }

  /**
   * Get the name of the relationship
   */
  getRelationName(): string {
    if (this.relationName) {
      return this.relationName;
    }

    // Try to infer from related model table name
    const relatedTable = (
      this.related.prototype.constructor as typeof Model
    ).getTable();
    return (this.related.prototype.constructor as typeof Model).singularize(
      relatedTable
    );
  }

  /**
   * Set the relation name
   */
  setRelationName(name: string): this {
    this.relationName = name;
    return this;
  }

  /**
   * Add the constraints for a relationship query
   */
  getRelationExistenceQuery(
    query: QueryBuilder<R>,
    parentQuery: QueryBuilder<any>,
    _columns: string[] = ["*"]
  ): QueryBuilder<R> {
    const parentTable = (this.parent.constructor as typeof Model).getTable();

    query.whereColumn(
      `${query.getTable()}.${this.ownerKey}`,
      "=",
      `${parentTable}.${this.foreignKey}`
    );

    return query;
  }

  /**
   * Get the child of the relationship
   */
  getChild(): Model {
    return this.parent;
  }

  /**
   * Make a new related instance
   */
  make(attributes: Record<string, any> = {}): R {
    const instance = new this.related();
    (instance as any).fill(attributes);
    return instance;
  }

  /**
   * Create a new related model and associate it
   */
  async create(attributes: Record<string, any>): Promise<R> {
    const instance = this.make(attributes);
    await (instance as any).save();
    this.associate(instance);
    return instance;
  }

  /**
   * Update the parent model
   */
  async updateParent(attributes: Record<string, any>): Promise<Model> {
    return (this.parent as any).update(attributes);
  }

  /**
   * Get the key value of the parent's foreign key
   */
  getParentKey(): any {
    return this.parent.getAttribute(this.foreignKey);
  }

  /**
   * Check if the parent model is associated with a related model
   */
  isAssociated(): boolean {
    const foreignValue = this.parent.getAttribute(this.foreignKey);
    return foreignValue !== null && foreignValue !== undefined;
  }

  /**
   * Check if the parent model is not associated with any related model
   */
  isNotAssociated(): boolean {
    return !this.isAssociated();
  }
}
