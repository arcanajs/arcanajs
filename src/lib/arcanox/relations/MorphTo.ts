import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

/**
 * Morph type resolver function
 */
export type MorphTypeResolver = (type: string) => new () => Model;

/**
 * MorphTo Relationship (Polymorphic BelongsTo)
 * Defines an inverse polymorphic relationship where the current model can belong to multiple types of models
 */
export class MorphTo<R extends Model = any> extends Relation<R> {
  protected foreignKey: string;
  protected morphType: string;
  protected ownerKey: string;
  protected typeMap: Record<string, new () => Model> = {};
  protected static globalMorphMap: Record<string, new () => Model> = {};

  constructor(
    query: QueryBuilder<R>,
    parent: Model,
    foreignKey: string,
    morphType: string,
    ownerKey: string = "id"
  ) {
    super(query, parent);
    this.foreignKey = foreignKey;
    this.morphType = morphType;
    this.ownerKey = ownerKey;
  }

  /**
   * Register a global morph map
   */
  static morphMap(map: Record<string, new () => Model>): void {
    Object.assign(this.globalMorphMap, map);
  }

  /**
   * Get the morph map
   */
  static getMorphMap(): Record<string, new () => Model> {
    return { ...this.globalMorphMap };
  }

  /**
   * Set the local morph type map
   */
  setTypeMap(map: Record<string, new () => Model>): this {
    this.typeMap = { ...this.typeMap, ...map };
    return this;
  }

  /**
   * Add the base constraints for the relation
   */
  addConstraints(): void {
    const morphType = this.parent.getAttribute(this.morphType);
    const foreignValue = this.parent.getAttribute(this.foreignKey);

    if (morphType && foreignValue) {
      this.query.where(this.ownerKey, "=", foreignValue);
    }
  }

  /**
   * Add eager loading constraints for multiple models
   */
  addEagerConstraints(models: Model[]): void {
    // Group models by morph type
    const byType: Record<string, Model[]> = {};

    for (const model of models) {
      const type = model.getAttribute(this.morphType);
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(model);
    }

    // We'll handle eager loading differently since we have multiple types
    // This method sets up the base query; actual loading happens in getEager
  }

  /**
   * Match eagerly loaded results to their parent models
   */
  match(models: Model[], results: R[], relation: string): Model[] {
    // Results are keyed by type and id
    const dictionary: Record<string, Record<string, R>> = {};

    for (const result of results) {
      const type =
        (result as any).__morphType ||
        (result.constructor as typeof Model).getTable();
      const id = this.normalizeKey(result.getAttribute(this.ownerKey));

      if (!dictionary[type]) {
        dictionary[type] = {};
      }
      dictionary[type][id] = result;
    }

    for (const model of models) {
      const type = model.getAttribute(this.morphType);
      const foreignKey = this.normalizeKey(model.getAttribute(this.foreignKey));

      const related =
        dictionary[type]?.[foreignKey] || this.getDefaultFor(model);
      model.setRelation(relation, related);
    }

    return models;
  }

  /**
   * Get the results of the relationship
   */
  async getResults(): Promise<R | null> {
    const morphType = this.parent.getAttribute(this.morphType);
    const foreignValue = this.parent.getAttribute(this.foreignKey);

    if (!morphType || foreignValue === null || foreignValue === undefined) {
      return this.getDefaultFor(this.parent);
    }

    // Resolve the model class
    const modelClass = this.resolveModelClass(morphType);
    if (!modelClass) {
      return null;
    }

    // Query the resolved model
    const result = await (modelClass as any).find(foreignValue);
    return result || this.getDefaultFor(this.parent);
  }

  /**
   * Resolve the model class from the morph type
   */
  protected resolveModelClass(type: string): (new () => Model) | null {
    // Check local map first
    if (this.typeMap[type]) {
      return this.typeMap[type];
    }

    // Check global map
    if (MorphTo.globalMorphMap[type]) {
      return MorphTo.globalMorphMap[type];
    }

    // Try to use the type as a table name and find a matching model
    // This is a fallback - ideally models should be registered in the morph map
    return null;
  }

  /**
   * Get the foreign key name
   */
  getForeignKeyName(): string {
    return this.foreignKey;
  }

  /**
   * Get the morph type column name
   */
  getMorphType(): string {
    return this.morphType;
  }

  /**
   * Get the owner key name
   */
  getOwnerKeyName(): string {
    return this.ownerKey;
  }

  /**
   * Associate the model with the given parent
   */
  associate(model: R): Model {
    const morphClass = (model.constructor as typeof Model).getTable();
    const foreignValue = model.getAttribute(this.ownerKey);

    (this.parent as any).setAttribute(this.foreignKey, foreignValue);
    (this.parent as any).setAttribute(this.morphType, morphClass);

    return this.parent.setRelation(this.getMorphRelationName(), model);
  }

  /**
   * Dissociate the model from the parent
   */
  dissociate(): Model {
    (this.parent as any).setAttribute(this.foreignKey, null);
    (this.parent as any).setAttribute(this.morphType, null);

    return this.parent.setRelation(this.getMorphRelationName(), null);
  }

  /**
   * Get the name of the morph relation
   */
  protected getMorphRelationName(): string {
    return this.morphType.replace("_type", "").replace("_id", "");
  }

  /**
   * Eager load the polymorphic relations for a set of models
   */
  async getEager(models: Model[]): Promise<R[]> {
    // Group models by morph type
    const byType: Record<string, { models: Model[]; keys: any[] }> = {};

    for (const model of models) {
      const type = model.getAttribute(this.morphType);
      const key = model.getAttribute(this.foreignKey);

      if (type && key !== null && key !== undefined) {
        if (!byType[type]) {
          byType[type] = { models: [], keys: [] };
        }
        byType[type].models.push(model);
        byType[type].keys.push(key);
      }
    }

    // Load results for each type
    const allResults: R[] = [];

    for (const [type, { keys }] of Object.entries(byType)) {
      const modelClass = this.resolveModelClass(type);
      if (!modelClass) continue;

      const uniqueKeys = [...new Set(keys)];
      const results = await (modelClass as any)
        .whereIn(this.ownerKey, uniqueKeys)
        .get();

      // Tag results with their morph type for matching
      for (const result of results) {
        (result as any).__morphType = type;
        allResults.push(result);
      }
    }

    return allResults;
  }

  /**
   * Create a constraint for existence queries
   */
  getRelationExistenceQuery(
    query: QueryBuilder<R>,
    parentQuery: QueryBuilder<any>,
    _columns: string[] = ["*"]
  ): QueryBuilder<R> {
    const parentTable = (this.parent.constructor as typeof Model).getTable();

    // This is complex for polymorphic relations
    // We need to check both the type and the foreign key
    query.whereColumn(
      `${query.getTable()}.${this.ownerKey}`,
      "=",
      `${parentTable}.${this.foreignKey}`
    );

    return query;
  }

  /**
   * Without constraints - useful for eager loading setup
   */
  withoutConstraints(): this {
    return this;
  }
}
