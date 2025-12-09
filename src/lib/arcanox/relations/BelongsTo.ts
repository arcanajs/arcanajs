import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

export class BelongsTo<R extends Model = any> extends Relation<R> {
  protected foreignKey: string;
  protected ownerKey: string;

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

  addConstraints(): void {
    const foreignValue = this.parent.getAttribute(this.foreignKey);
    this.query.where(this.ownerKey, "=", foreignValue);
  }

  addEagerConstraints(models: Model[]): void {
    const keys = models
      .map((model) => model.getAttribute(this.foreignKey))
      .filter((k) => k !== null);
    this.query.whereIn(this.ownerKey, keys);
  }

  match(models: Model[], results: R[], relation: string): Model[] {
    const dictionary: Record<string, R> = {};

    results.forEach((result) => {
      const key = this.normalizeKey(result.getAttribute(this.ownerKey));
      dictionary[key] = result;
    });

    models.forEach((model) => {
      const key = this.normalizeKey(model.getAttribute(this.foreignKey));
      if (dictionary[key]) {
        model.setRelation(relation, dictionary[key]);
      }
    });

    return models;
  }
}
