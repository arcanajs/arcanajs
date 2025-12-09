import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";

export abstract class Relation<R extends Model = any> {
  protected query: QueryBuilder<R>;
  protected parent: Model;
  protected related: new () => R;

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

  abstract addConstraints(): void;

  abstract addEagerConstraints(models: Model[]): void;

  abstract match(models: Model[], results: R[], relation: string): Model[];

  getQuery(): QueryBuilder<R> {
    return this.query;
  }

  async get(): Promise<R[]> {
    return this.query.get();
  }

  async first(): Promise<R | null> {
    return this.query.first();
  }

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
}
