import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

export class HasMany<R extends Model = any> extends Relation<R> {
  protected foreignKey: string;
  protected localKey: string;

  constructor(
    query: QueryBuilder<R>,
    parent: Model,
    foreignKey: string,
    localKey: string
  ) {
    super(query, parent);
    this.foreignKey = foreignKey;
    this.localKey = localKey;
    if (!this.foreignKey) {
      console.error("HasMany: foreignKey is undefined!", {
        foreignKey,
        localKey,
      });
    }
  }

  addConstraints(): void {
    const localValue = this.parent.getAttribute(this.localKey);
    this.query.where(this.foreignKey, "=", localValue);
  }

  addEagerConstraints(models: Model[]): void {
    const keys = models
      .map((model) => model.getAttribute(this.localKey))
      .filter((k) => k !== null);
    this.query.whereIn(this.foreignKey, keys);
  }

  match(models: Model[], results: R[], relation: string): Model[] {
    const dictionary: Record<string, R[]> = {};

    results.forEach((result) => {
      const key = this.normalizeKey(result.getAttribute(this.foreignKey));
      if (!dictionary[key]) {
        dictionary[key] = [];
      }
      dictionary[key].push(result);
    });

    models.forEach((model) => {
      const key = this.normalizeKey(model.getAttribute(this.localKey));
      if (dictionary[key]) {
        model.setRelation(relation, dictionary[key]);
      } else {
        model.setRelation(relation, []);
      }
    });

    return models;
  }
}
