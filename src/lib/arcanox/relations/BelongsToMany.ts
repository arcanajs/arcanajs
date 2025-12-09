import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Relation } from "./Relation";

/**
 * Pivot data attached to related models
 */
export interface PivotData {
  [key: string]: any;
}

/**
 * BelongsToMany Relationship
 * Defines a many-to-many relationship using a pivot table
 */
export class BelongsToMany<R extends Model = any> extends Relation<R> {
  protected table: string;
  protected foreignPivotKey: string;
  protected relatedPivotKey: string;
  protected parentKey: string;
  protected relatedKey: string;
  protected pivotColumns: string[] = [];
  protected pivotWheres: Array<{
    column: string;
    operator: string;
    value: any;
  }> = [];
  protected pivotWhereIns: Array<{ column: string; values: any[] }> = [];
  protected pivotWhereNulls: string[] = [];
  protected withTimestamps: boolean = false;
  protected pivotCreatedAt: string = "created_at";
  protected pivotUpdatedAt: string = "updated_at";
  protected using: (new () => any) | null = null;
  protected accessor: string = "pivot";

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

  /**
   * Include timestamps in the pivot table
   */
  withPivotTimestamps(createdAt?: string, updatedAt?: string): this {
    this.withTimestamps = true;
    if (createdAt) this.pivotCreatedAt = createdAt;
    if (updatedAt) this.pivotUpdatedAt = updatedAt;
    return this.withPivot(this.pivotCreatedAt, this.pivotUpdatedAt);
  }

  /**
   * Add a where clause to the pivot table query
   */
  wherePivot(column: string, operator: string, value?: any): this {
    if (value === undefined) {
      value = operator;
      operator = "=";
    }
    this.pivotWheres.push({ column, operator, value });
    return this;
  }

  /**
   * Add a where in clause to the pivot table query
   */
  wherePivotIn(column: string, values: any[]): this {
    this.pivotWhereIns.push({ column, values });
    return this;
  }

  /**
   * Add a where null clause to the pivot table query
   */
  wherePivotNull(column: string): this {
    this.pivotWhereNulls.push(column);
    return this;
  }

  /**
   * Set the pivot accessor name
   */
  as(accessor: string): this {
    this.accessor = accessor;
    return this;
  }

  /**
   * Use a custom pivot model
   */
  usingPivotModel(pivotClass: new () => any): this {
    this.using = pivotClass;
    return this;
  }

  addConstraints(): void {
    this.performJoin();
    this.addPivotSelect();
    this.addPivotWhereConstraints();
    this.query.where(
      `${this.table}.${this.foreignPivotKey}`,
      "=",
      this.parent.getAttribute(this.parentKey)
    );
  }

  /**
   * Add pivot where constraints
   */
  protected addPivotWhereConstraints(): void {
    for (const where of this.pivotWheres) {
      this.query.where(
        `${this.table}.${where.column}`,
        where.operator,
        where.value
      );
    }

    for (const whereIn of this.pivotWhereIns) {
      this.query.whereIn(`${this.table}.${whereIn.column}`, whereIn.values);
    }

    for (const column of this.pivotWhereNulls) {
      this.query.whereNull(`${this.table}.${column}`);
    }
  }

  /**
   * Add pivot columns to the select statement
   */
  protected addPivotSelect(): void {
    const pivotSelects = [
      `${this.table}.${this.foreignPivotKey} as pivot_${this.foreignPivotKey}`,
      `${this.table}.${this.relatedPivotKey} as pivot_${this.relatedPivotKey}`,
    ];

    for (const column of this.pivotColumns) {
      pivotSelects.push(`${this.table}.${column} as pivot_${column}`);
    }

    const relatedInstance = new this.related();
    const relatedTable = (
      relatedInstance.constructor as typeof Model
    ).getTable();

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
    this.addPivotWhereConstraints();
    const keys = models
      .map((model) => model.getAttribute(this.parentKey))
      .filter((k) => k !== null && k !== undefined);
    this.query.whereIn(`${this.table}.${this.foreignPivotKey}`, keys);
  }

  match(models: Model[], results: R[], relation: string): Model[] {
    const dictionary: Record<string, R[]> = {};

    results.forEach((result) => {
      const pivotKey =
        (result as any)[`pivot_${this.foreignPivotKey}`] ||
        (result as any).getAttribute?.(`pivot_${this.foreignPivotKey}`);

      const key = this.normalizeKey(pivotKey);

      if (key) {
        if (!dictionary[key]) {
          dictionary[key] = [];
        }

        // Create pivot data
        const pivot: PivotData = {
          [this.foreignPivotKey]: pivotKey,
          [this.relatedPivotKey]: (result as any)[
            `pivot_${this.relatedPivotKey}`
          ],
        };

        for (const column of this.pivotColumns) {
          pivot[column] = (result as any)[`pivot_${column}`];
        }

        // Attach pivot to the model
        (result as any)[this.accessor] = this.using
          ? this.newPivot(pivot)
          : pivot;

        dictionary[key].push(result);
      }
    });

    models.forEach((model) => {
      const key = this.normalizeKey(model.getAttribute(this.parentKey));
      model.setRelation(relation, dictionary[key] || []);
    });

    return models;
  }

  /**
   * Get the results of the relationship
   */
  async getResults(): Promise<R[]> {
    return this.get();
  }

  /**
   * Create a new pivot model instance
   */
  protected newPivot(attributes: PivotData): any {
    if (this.using) {
      const pivot = new this.using();
      Object.assign(pivot, attributes);
      return pivot;
    }
    return attributes;
  }

  /**
   * Get the pivot table name
   */
  getTable(): string {
    return this.table;
  }

  /**
   * Get the foreign pivot key
   */
  getForeignPivotKeyName(): string {
    return this.foreignPivotKey;
  }

  /**
   * Get the related pivot key
   */
  getRelatedPivotKeyName(): string {
    return this.relatedPivotKey;
  }

  /**
   * Attach models to the pivot table
   */
  async attach(
    ids: any | any[],
    attributes: Record<string, any> = {}
  ): Promise<void> {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const parentId = this.parent.getAttribute(this.parentKey);

    for (const id of idsArray) {
      const pivotData: Record<string, any> = {
        [this.foreignPivotKey]: parentId,
        [this.relatedPivotKey]: typeof id === "object" ? id.id || id : id,
        ...(typeof id === "object" && id.pivot ? id.pivot : {}),
        ...attributes,
      };

      // Add timestamps if enabled
      if (this.withTimestamps) {
        const now = new Date();
        pivotData[this.pivotCreatedAt] = now;
        pivotData[this.pivotUpdatedAt] = now;
      }

      await this.query.getAdapter().insert(this.table, pivotData);
    }
  }

  /**
   * Detach models from the pivot table
   */
  async detach(ids?: any | any[]): Promise<number> {
    const parentId = this.parent.getAttribute(this.parentKey);
    let count = 0;

    if (ids === undefined) {
      // Detach all
      const result = await this.query
        .getAdapter()
        .raw?.(`DELETE FROM ${this.table} WHERE ${this.foreignPivotKey} = ?`, [
          parentId,
        ]);
      count = result?.affectedRows || result?.rowCount || 1;
    } else {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      for (const id of idsArray) {
        const result = await this.query
          .getAdapter()
          .raw?.(
            `DELETE FROM ${this.table} WHERE ${this.foreignPivotKey} = ? AND ${this.relatedPivotKey} = ?`,
            [parentId, id]
          );
        count += result?.affectedRows || result?.rowCount || 1;
      }
    }

    return count;
  }

  /**
   * Sync the pivot table with the given IDs
   */
  async sync(
    ids: any[],
    detaching: boolean = true
  ): Promise<{
    attached: any[];
    detached: any[];
    updated: any[];
  }> {
    const changes = {
      attached: [] as any[],
      detached: [] as any[],
      updated: [] as any[],
    };

    // Get current related IDs
    const currentIds = await this.allRelatedIds();

    // Normalize input
    const records: Record<string, Record<string, any>> = {};
    for (const id of ids) {
      if (typeof id === "object" && id !== null && !Array.isArray(id)) {
        const { id: recordId, ...attributes } = id;
        records[recordId] = attributes;
      } else {
        records[String(id)] = {};
      }
    }

    // Determine what to detach
    if (detaching) {
      const detachIds = currentIds.filter((id) => !(String(id) in records));
      if (detachIds.length > 0) {
        await this.detach(detachIds);
        changes.detached = detachIds;
      }
    }

    // Determine what to attach or update
    const currentIdStrings = currentIds.map((id) => String(id));

    for (const [id, attributes] of Object.entries(records)) {
      if (currentIdStrings.includes(id)) {
        // Update existing
        if (Object.keys(attributes).length > 0) {
          await this.updateExistingPivot(id, attributes);
          changes.updated.push(id);
        }
      } else {
        // Attach new
        await this.attach(id, attributes);
        changes.attached.push(id);
      }
    }

    return changes;
  }

  /**
   * Sync without detaching existing records
   */
  async syncWithoutDetaching(ids: any[]): Promise<{
    attached: any[];
    detached: any[];
    updated: any[];
  }> {
    return this.sync(ids, false);
  }

  /**
   * Update an existing pivot record
   */
  async updateExistingPivot(
    relatedId: any,
    attributes: Record<string, any>
  ): Promise<number> {
    const parentId = this.parent.getAttribute(this.parentKey);

    const updateData = { ...attributes };
    if (this.withTimestamps) {
      updateData[this.pivotUpdatedAt] = new Date();
    }

    const result = await this.query.getAdapter().raw?.(
      `UPDATE ${this.table} SET ${Object.keys(updateData)
        .map((k) => `${k} = ?`)
        .join(", ")} WHERE ${this.foreignPivotKey} = ? AND ${
        this.relatedPivotKey
      } = ?`,
      [...Object.values(updateData), parentId, relatedId]
    );

    return result?.affectedRows || result?.rowCount || 0;
  }

  /**
   * Get all related IDs
   */
  async allRelatedIds(): Promise<any[]> {
    const parentId = this.parent.getAttribute(this.parentKey);

    const results = await this.query.getAdapter().select(this.table, {
      where: [
        {
          column: this.foreignPivotKey,
          operator: "=",
          value: parentId,
          boolean: "AND",
        },
      ],
    });

    return results.map((r: any) => r[this.relatedPivotKey]);
  }

  /**
   * Toggle the attachment status of the given IDs
   */
  async toggle(ids: any[]): Promise<{
    attached: any[];
    detached: any[];
  }> {
    const changes = {
      attached: [] as any[],
      detached: [] as any[],
    };

    const currentIds = await this.allRelatedIds();
    const currentIdStrings = currentIds.map((id) => String(id));

    for (const id of ids) {
      const idString = String(id);

      if (currentIdStrings.includes(idString)) {
        await this.detach(id);
        changes.detached.push(id);
      } else {
        await this.attach(id);
        changes.attached.push(id);
      }
    }

    return changes;
  }

  /**
   * Find a specific model in the relationship
   */
  async findInPivot(id: any): Promise<R | null> {
    const results = await this.get();
    return (
      results.find((r: any) => {
        const pivotRelatedKey = r[this.accessor]?.[this.relatedPivotKey];
        return (
          this.normalizeKey(pivotRelatedKey) === this.normalizeKey(id) ||
          this.normalizeKey(r.id) === this.normalizeKey(id)
        );
      }) || null
    );
  }

  /**
   * Update the pivot data for a specific related model
   */
  async updatePivot(id: any, attributes: Record<string, any>): Promise<number> {
    return this.updateExistingPivot(id, attributes);
  }

  /**
   * Create a new related model and attach it
   */
  async create(
    attributes: Record<string, any>,
    pivotAttributes: Record<string, any> = {}
  ): Promise<R> {
    const instance = new this.related();
    (instance as any).fill(attributes);
    await (instance as any).save();

    await this.attach((instance as any).id, pivotAttributes);

    return instance;
  }

  /**
   * Create multiple related models and attach them
   */
  async createMany(
    records: Array<{
      attributes: Record<string, any>;
      pivot?: Record<string, any>;
    }>
  ): Promise<R[]> {
    const instances: R[] = [];

    for (const record of records) {
      const instance = await this.create(record.attributes, record.pivot || {});
      instances.push(instance);
    }

    return instances;
  }

  /**
   * Find or create a related model and attach it if not already attached
   */
  async firstOrCreate(
    attributes: Record<string, any>,
    pivotAttributes: Record<string, any> = {}
  ): Promise<R> {
    // Check if already attached
    const existing = await this.where(
      Object.keys(attributes)[0],
      Object.values(attributes)[0]
    ).first();

    if (existing) {
      return existing;
    }

    return this.create(attributes, pivotAttributes);
  }

  /**
   * Paginate the relationship
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
}
