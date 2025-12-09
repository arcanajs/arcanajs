import type {
  JoinClause,
  OrderByClause,
  SelectOptions,
  WhereClause,
} from "./types";

import { Macroable } from "./support/Macroable";

/**
 * Query Builder - Fluent interface for building database queries
 * Arcanox Query Builder
 */
export class QueryBuilder<T = any> extends Macroable {
  protected tableName: string;
  protected selectColumns: string[] = ["*"];
  protected whereClauses: WhereClause[] = [];
  protected orderByClauses: OrderByClause[] = [];
  protected joinClauses: JoinClause[] = [];
  protected limitValue?: number;
  protected offsetValue?: number;
  protected adapter: any; // DatabaseAdapter

  constructor(table: string, adapter: any) {
    super();
    this.tableName = table;
    this.adapter = adapter;
  }

  /**
   * Get the database adapter
   */
  getAdapter(): any {
    return this.adapter;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Add a WHERE clause
   */
  where(column: string, operator: any, value?: any): this {
    // Support where(column, value) syntax
    if (value === undefined) {
      value = operator;
      operator = "=";
    }

    this.whereClauses.push({
      column,
      operator,
      value,
      boolean: "AND",
    });
    return this;
  }

  /**
   * Add an OR WHERE clause
   */
  orWhere(column: string, operator: any, value?: any): this {
    if (value === undefined) {
      value = operator;
      operator = "=";
    }

    this.whereClauses.push({
      column,
      operator,
      value,
      boolean: "OR",
    });
    return this;
  }

  /**
   * WHERE IN clause
   */
  whereIn(column: string, values: any[]): this {
    this.whereClauses.push({
      column,
      operator: "IN",
      value: values,
      boolean: "AND",
    });
    return this;
  }

  /**
   * WHERE NOT IN clause
   */
  whereNotIn(column: string, values: any[]): this {
    this.whereClauses.push({
      column,
      operator: "NOT IN",
      value: values,
      boolean: "AND",
    });
    return this;
  }

  /**
   * WHERE BETWEEN clause
   */
  whereBetween(column: string, range: [any, any]): this {
    this.whereClauses.push({
      column,
      operator: "BETWEEN",
      value: range,
      boolean: "AND",
    });
    return this;
  }

  /**
   * WHERE NULL clause
   */
  whereNull(column: string): this {
    this.whereClauses.push({
      column,
      operator: "IS NULL",
      value: null,
      boolean: "AND",
    });
    return this;
  }

  /**
   * WHERE NOT NULL clause
   */
  whereNotNull(column: string): this {
    this.whereClauses.push({
      column,
      operator: "IS NOT NULL",
      value: null,
      boolean: "AND",
    });
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(
    column: string,
    direction: "ASC" | "DESC" | "asc" | "desc" = "ASC"
  ): this {
    this.orderByClauses.push({
      column,
      direction: direction.toUpperCase() as "ASC" | "DESC",
    });
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Add JOIN clause
   */
  join(
    table: string,
    first: string,
    operator: string,
    second: string,
    type: "INNER" | "LEFT" | "RIGHT" = "INNER"
  ): this {
    this.joinClauses.push({
      type,
      table,
      first,
      operator,
      second,
    });
    return this;
  }

  /**
   * Add LEFT JOIN clause
   */
  leftJoin(
    table: string,
    first: string,
    operator: string,
    second: string
  ): this {
    return this.join(table, first, operator, second, "LEFT");
  }

  /**
   * Add RIGHT JOIN clause
   */
  rightJoin(
    table: string,
    first: string,
    operator: string,
    second: string
  ): this {
    return this.join(table, first, operator, second, "RIGHT");
  }

  protected eagerLoads: string[] = [];
  protected model: any; // Model class

  /**
   * Set the model class
   */
  setModel(model: any): this {
    this.model = model;
    return this;
  }

  /**
   * Eager load relationships
   */
  with(relations: string | string[]): this {
    if (Array.isArray(relations)) {
      this.eagerLoads.push(...relations);
    } else {
      this.eagerLoads.push(relations);
    }
    return this;
  }

  /**
   * Execute query and get all results
   */
  async get(): Promise<T[]> {
    const options: SelectOptions = {
      columns: this.selectColumns,
      where: this.whereClauses,
      orderBy: this.orderByClauses,
      limit: this.limitValue,
      offset: this.offsetValue,
      joins: this.joinClauses,
    };

    const rows = await this.adapter.select(this.tableName, options);

    if (!this.model) {
      return rows;
    }

    const models = rows.map((row: any) => this.model.hydrate(row)) as T[];

    if (this.eagerLoads.length > 0) {
      await this.eagerLoadRelations(models);
    }

    return models;
  }

  /**
   * Eager load relations
   */
  protected async eagerLoadRelations(models: any[]): Promise<any[]> {
    if (models.length === 0) return models;

    for (const relationName of this.eagerLoads) {
      // Check if relation exists on model
      const instance = new this.model();
      if (typeof instance[relationName] !== "function") {
        throw new Error(
          `Relation ${relationName} does not exist on ${this.model.name}`
        );
      }

      // Get relation instance
      const relation = instance[relationName]();

      // Add constraints for eager loading
      relation.addEagerConstraints(models);

      // Get related results
      const relatedResults = await relation.get();

      // Match results to models
      relation.match(models, relatedResults, relationName);
    }

    return models;
  }

  /**
   * Get first result
   */
  async first(): Promise<T | null> {
    this.limit(1);
    const results = await this.get();
    return results[0] || null;
  }

  /**
   * Find by ID
   */
  async find(id: any): Promise<T | null> {
    return this.where("id", id).first();
  }

  /**
   * Count results
   */
  async count(): Promise<number> {
    this.selectColumns = ["COUNT(*) as count"];
    const result = await this.first();
    return result ? (result as any).count : 0;
  }

  /**
   * Get specific column values
   */
  async pluck(column: string): Promise<any[]> {
    this.select(column);
    const results = await this.get();
    return results.map((row) => (row as any)[column]);
  }

  /**
   * Sum of column
   */
  async sum(column: string): Promise<number> {
    this.selectColumns = [`SUM(${column}) as sum`];
    const result = await this.first();
    return result ? (result as any).sum || 0 : 0;
  }

  /**
   * Average of column
   */
  async avg(column: string): Promise<number> {
    this.selectColumns = [`AVG(${column}) as avg`];
    const result = await this.first();
    return result ? (result as any).avg || 0 : 0;
  }

  /**
   * Minimum value of column
   */
  async min(column: string): Promise<any> {
    this.selectColumns = [`MIN(${column}) as min`];
    const result = await this.first();
    return result ? (result as any).min : null;
  }

  /**
   * Maximum value of column
   */
  async max(column: string): Promise<any> {
    this.selectColumns = [`MAX(${column}) as max`];
    const result = await this.first();
    return result ? (result as any).max : null;
  }

  /**
   * Check if any records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Paginate results
   */
  async paginate(
    page: number = 1,
    perPage: number = 15
  ): Promise<{
    data: T[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  }> {
    const total = await this.count();
    const offset = (page - 1) * perPage;

    this.limit(perPage).offset(offset);
    const data = await this.get();

    return {
      data,
      total,
      perPage,
      currentPage: page,
      lastPage: Math.ceil(total / perPage),
    };
  }

  /**
   * Clone the query builder
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>(this.tableName, this.adapter);
    cloned.selectColumns = [...this.selectColumns];
    cloned.whereClauses = [...this.whereClauses];
    cloned.orderByClauses = [...this.orderByClauses];
    cloned.joinClauses = [...this.joinClauses];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    return cloned;
  }
}
