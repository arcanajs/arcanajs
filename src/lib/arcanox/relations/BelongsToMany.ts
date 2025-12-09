import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

export class BelongsToMany<R extends Model = any> extends Relation<R> {
  protected table: string;
  protected foreignPivotKey: string;
  protected relatedPivotKey: string;
  protected parentKey: string;
  protected relatedKey: string;
  protected pivotColumns: string[] = [];

  constructor(
    query: QueryBuilder<R>,
    parent: Model,
    table: string,
    foreignPivotKey: string,
    relatedPivotKey: string,
    parentKey: string,
    relatedKey: string
  ) {
    super(query, parent);
    this.table = table;
    this.foreignPivotKey = foreignPivotKey;
    this.relatedPivotKey = relatedPivotKey;
    this.parentKey = parentKey;
    this.relatedKey = relatedKey;
  }

  /**
   * Specify additional pivot columns to retrieve
   */
  withPivot(...columns: string[]): this {
    this.pivotColumns.push(...columns);
    return this;
  }

  addConstraints(): void {
    this.performJoin();
    this.addPivotSelect();
    this.query.where(
      `${this.table}.${this.foreignPivotKey}`,
      "=",
      this.parent.getAttribute(this.parentKey)
    );
  }

  /**
   * Add pivot columns to the select statement
   */
  protected addPivotSelect(): void {
    // Always select the foreign pivot key so we can match results to parents
    const pivotSelects = [
      `${this.table}.${this.foreignPivotKey} as pivot_${this.foreignPivotKey}`,
      `${this.table}.${this.relatedPivotKey} as pivot_${this.relatedPivotKey}`,
    ];

    // Add any additional pivot columns
    for (const column of this.pivotColumns) {
      pivotSelects.push(`${this.table}.${column} as pivot_${column}`);
    }

    // Get the related table name
    const relatedInstance = new this.related();
    const relatedTable = (
      relatedInstance.constructor as typeof Model
    ).getTable();

    // Select all columns from related table plus pivot columns
    this.query.select(`${relatedTable}.*`, ...pivotSelects);
  }

  protected performJoin(query?: QueryBuilder<R>): this {
    const q = query || this.query;
    const relatedInstance = new this.related();
    const relatedTable = (
      relatedInstance.constructor as typeof Model
    ).getTable();

    q.join(
      this.table,
      `${relatedTable}.${this.relatedKey}`,
      "=",
      `${this.table}.${this.relatedPivotKey}`
    );

    return this;
  }

  addEagerConstraints(models: Model[]): void {
    this.performJoin();
    this.addPivotSelect();
    const keys = models
      .map((model) => model.getAttribute(this.parentKey))
      .filter((k) => k !== null);
    this.query.whereIn(`${this.table}.${this.foreignPivotKey}`, keys);
  }

  match(models: Model[], results: R[], relation: string): Model[] {
    const dictionary: Record<string, R[]> = {};

    // Build dictionary keyed by the foreign pivot key (parent's key)
    results.forEach((result) => {
      // Get the pivot foreign key from the result (it was selected as pivot_foreignPivotKey)
      const pivotKey =
        (result as any)[`pivot_${this.foreignPivotKey}`] ||
        (result as any).getAttribute?.(`pivot_${this.foreignPivotKey}`);

      const key = this.normalizeKey(pivotKey);

      if (key) {
        if (!dictionary[key]) {
          dictionary[key] = [];
        }

        // Attach pivot data to the result
        const pivot: Record<string, any> = {
          [this.foreignPivotKey]: pivotKey,
          [this.relatedPivotKey]: (result as any)[
            `pivot_${this.relatedPivotKey}`
          ],
        };

        // Add additional pivot columns
        for (const column of this.pivotColumns) {
          pivot[column] = (result as any)[`pivot_${column}`];
        }

        // Set pivot on the model
        (result as any).pivot = pivot;

        dictionary[key].push(result);
      }
    });

    // Match results to models
    models.forEach((model) => {
      const key = this.normalizeKey(model.getAttribute(this.parentKey));
      if (dictionary[key]) {
        model.setRelation(relation, dictionary[key]);
      } else {
        model.setRelation(relation, []);
      }
    });

    return models;
  }

  /**
   * Attach a model to the pivot table
   */
  async attach(
    ids: any | any[],
    attributes: Record<string, any> = {}
  ): Promise<void> {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const parentId = this.parent.getAttribute(this.parentKey);

    for (const id of idsArray) {
      const pivotData = {
        [this.foreignPivotKey]: parentId,
        [this.relatedPivotKey]: id,
        ...attributes,
      };

      // Insert into pivot table
      await this.query.getAdapter().insert(this.table, pivotData);
    }
  }

  /**
   * Detach models from the pivot table
   */
  async detach(ids?: any | any[]): Promise<void> {
    const parentId = this.parent.getAttribute(this.parentKey);

    if (ids === undefined) {
      // Detach all
      await this.query
        .getAdapter()
        .raw?.(`DELETE FROM ${this.table} WHERE ${this.foreignPivotKey} = ?`, [
          parentId,
        ]);
    } else {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      for (const id of idsArray) {
        await this.query
          .getAdapter()
          .raw?.(
            `DELETE FROM ${this.table} WHERE ${this.foreignPivotKey} = ? AND ${this.relatedPivotKey} = ?`,
            [parentId, id]
          );
      }
    }
  }

  /**
   * Sync the pivot table with the given IDs
   */
  async sync(ids: any[]): Promise<void> {
    await this.detach();
    await this.attach(ids);
  }

  /**
   * Toggle the attachment status of the given IDs
   */
  async toggle(ids: any[]): Promise<void> {
    const parentId = this.parent.getAttribute(this.parentKey);

    for (const id of ids) {
      // Check if relation exists
      const existing = await this.query.getAdapter().select(this.table, {
        where: [
          {
            column: this.foreignPivotKey,
            operator: "=",
            value: parentId,
            boolean: "AND",
          },
          {
            column: this.relatedPivotKey,
            operator: "=",
            value: id,
            boolean: "AND",
          },
        ],
        limit: 1,
      });

      if (existing && existing.length > 0) {
        await this.detach(id);
      } else {
        await this.attach(id);
      }
    }
  }
}
