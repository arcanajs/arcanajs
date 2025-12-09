import type {
  CursorPaginationResult,
  JoinClause,
  OrderByClause,
  PaginationResult,
  SelectOptions,
  WhereClause,
  WhereOperator,
} from "./types";

import { Macroable } from "./support/Macroable";

/**
 * Query Builder - Fluent interface for building database queries
 * Arcanox Query Builder - Professional ORM/ODM Query Builder
 *
 * Supports:
 * - Fluent chainable API
 * - Complex WHERE conditions with nested groups
 * - Joins (INNER, LEFT, RIGHT, FULL, CROSS)
 * - Aggregations and grouping
 * - Subqueries
 * - Transactions
 * - Eager loading
 * - Cursor and offset pagination
 * - Locking (FOR UPDATE, FOR SHARE)
 */
export class QueryBuilder<T = any> extends Macroable {
  protected tableName: string;
  protected selectColumns: string[] = ["*"];
  protected whereClauses: WhereClause[] = [];
  protected orderByClauses: OrderByClause[] = [];
  protected joinClauses: JoinClause[] = [];
  protected groupByClauses: string[] = [];
  protected havingClauses: WhereClause[] = [];
  protected limitValue?: number;
  protected offsetValue?: number;
  protected distinctValue: boolean = false;
  protected adapter: any; // DatabaseAdapter

  // Locking options
  protected forUpdateValue: boolean = false;
  protected forShareValue: boolean = false;
  protected skipLockedValue: boolean = false;
  protected noWaitValue: boolean = false;

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
   * Get the table name
   */
  getTable(): string {
    return this.tableName;
  }

  // ==========================================================================
  // SELECT METHODS
  // ==========================================================================

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Add columns to selection
   */
  addSelect(...columns: string[]): this {
    if (this.selectColumns.includes("*")) {
      this.selectColumns = columns;
    } else {
      this.selectColumns.push(...columns);
    }
    return this;
  }

  /**
   * Select distinct rows
   */
  distinct(): this {
    this.distinctValue = true;
    return this;
  }

  /**
   * Select raw expression
   */
  selectRaw(expression: string, alias?: string): this {
    const col = alias ? `${expression} as ${alias}` : expression;
    if (this.selectColumns.includes("*")) {
      this.selectColumns = [col];
    } else {
      this.selectColumns.push(col);
    }
    return this;
  }

  // ==========================================================================
  // WHERE METHODS
  // ==========================================================================

  /**
   * Add a WHERE clause
   */
  where(
    column: string,
    operatorOrValue: WhereOperator | any,
    value?: any
  ): this {
    // Support where(column, value) syntax
    if (value === undefined) {
      value = operatorOrValue;
      operatorOrValue = "=";
    }

    this.whereClauses.push({
      column,
      operator: operatorOrValue as WhereOperator,
      value,
      boolean: "AND",
    });
    return this;
  }

  /**
   * Add an OR WHERE clause
   */
  orWhere(
    column: string,
    operatorOrValue: WhereOperator | any,
    value?: any
  ): this {
    if (value === undefined) {
      value = operatorOrValue;
      operatorOrValue = "=";
    }

    this.whereClauses.push({
      column,
      operator: operatorOrValue as WhereOperator,
      value,
      boolean: "OR",
    });
    return this;
  }

  /**
   * WHERE with callback for nested conditions
   */
  whereNested(
    callback: (query: QueryBuilder<T>) => void,
    boolean: "AND" | "OR" = "AND"
  ): this {
    const nestedQuery = new QueryBuilder<T>(this.tableName, this.adapter);
    callback(nestedQuery);

    if (nestedQuery.whereClauses.length > 0) {
      this.whereClauses.push({
        column: "",
        operator: "=" as WhereOperator,
        value: null,
        boolean,
        nested: nestedQuery.whereClauses,
      });
    }
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
   * OR WHERE IN clause
   */
  orWhereIn(column: string, values: any[]): this {
    this.whereClauses.push({
      column,
      operator: "IN",
      value: values,
      boolean: "OR",
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
   * WHERE NOT BETWEEN clause
   */
  whereNotBetween(column: string, range: [any, any]): this {
    this.whereClauses.push({
      column,
      operator: "NOT BETWEEN",
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
   * OR WHERE NULL clause
   */
  orWhereNull(column: string): this {
    this.whereClauses.push({
      column,
      operator: "IS NULL",
      value: null,
      boolean: "OR",
    });
    return this;
  }

  /**
   * WHERE LIKE clause
   */
  whereLike(column: string, pattern: string): this {
    this.whereClauses.push({
      column,
      operator: "LIKE",
      value: pattern,
      boolean: "AND",
    });
    return this;
  }

  /**
   * WHERE NOT LIKE clause
   */
  whereNotLike(column: string, pattern: string): this {
    this.whereClauses.push({
      column,
      operator: "NOT LIKE",
      value: pattern,
      boolean: "AND",
    });
    return this;
  }

  /**
   * WHERE with date comparisons
   */
  whereDate(
    column: string,
    operator: WhereOperator | string,
    value?: any
  ): this {
    if (value === undefined) {
      value = operator;
      operator = "=";
    }
    // Convert to date-only comparison
    return this.where(`DATE(${column})`, operator as WhereOperator, value);
  }

  /**
   * WHERE column equals another column
   */
  whereColumn(first: string, operator: string, second?: string): this {
    if (second === undefined) {
      second = operator;
      operator = "=";
    }
    this.whereClauses.push({
      column: first,
      operator: operator as WhereOperator,
      value: { $column: second },
      boolean: "AND",
      raw: true,
    });
    return this;
  }

  /**
   * WHERE raw SQL
   */
  whereRaw(sql: string, bindings: any[] = []): this {
    this.whereClauses.push({
      column: sql,
      operator: "=" as WhereOperator,
      value: bindings,
      boolean: "AND",
      raw: true,
    });
    return this;
  }

  // ==========================================================================
  // JOIN METHODS
  // ==========================================================================

  /**
   * Add INNER JOIN clause
   */
  join(table: string, first: string, operator: string, second: string): this {
    return this.addJoin("INNER", table, first, operator, second);
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
    return this.addJoin("LEFT", table, first, operator, second);
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
    return this.addJoin("RIGHT", table, first, operator, second);
  }

  /**
   * Add FULL OUTER JOIN clause
   */
  fullJoin(
    table: string,
    first: string,
    operator: string,
    second: string
  ): this {
    return this.addJoin("FULL", table, first, operator, second);
  }

  /**
   * Add CROSS JOIN clause
   */
  crossJoin(table: string): this {
    this.joinClauses.push({
      type: "CROSS",
      table,
      first: "",
      operator: "",
      second: "",
    });
    return this;
  }

  /**
   * Add join with alias
   */
  joinAs(
    table: string,
    alias: string,
    first: string,
    operator: string,
    second: string
  ): this {
    this.joinClauses.push({
      type: "INNER",
      table,
      first,
      operator,
      second,
      alias,
    });
    return this;
  }

  private addJoin(
    type: JoinClause["type"],
    table: string,
    first: string,
    operator: string,
    second: string
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

  // ==========================================================================
  // ORDER BY METHODS
  // ==========================================================================

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
   * Order by descending
   */
  orderByDesc(column: string): this {
    return this.orderBy(column, "DESC");
  }

  /**
   * Order by latest (created_at DESC)
   */
  latest(column: string = "created_at"): this {
    return this.orderBy(column, "DESC");
  }

  /**
   * Order by oldest (created_at ASC)
   */
  oldest(column: string = "created_at"): this {
    return this.orderBy(column, "ASC");
  }

  /**
   * Order randomly
   */
  inRandomOrder(): this {
    // This will be handled by the adapter
    this.orderByClauses.push({
      column: "RANDOM()",
      direction: "ASC",
    });
    return this;
  }

  /**
   * Reorder - clear all order by clauses and add new one
   */
  reorder(column?: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClauses = [];
    if (column) {
      this.orderBy(column, direction);
    }
    return this;
  }

  // ==========================================================================
  // GROUP BY AND HAVING METHODS
  // ==========================================================================

  /**
   * Add GROUP BY clause
   */
  groupBy(...columns: string[]): this {
    this.groupByClauses.push(...columns);
    return this;
  }

  /**
   * Add HAVING clause
   */
  having(column: string, operator: WhereOperator | any, value?: any): this {
    if (value === undefined) {
      value = operator;
      operator = "=";
    }

    this.havingClauses.push({
      column,
      operator: operator as WhereOperator,
      value,
      boolean: "AND",
    });
    return this;
  }

  /**
   * Add HAVING raw clause
   */
  havingRaw(sql: string, bindings: any[] = []): this {
    this.havingClauses.push({
      column: sql,
      operator: "=" as WhereOperator,
      value: bindings,
      boolean: "AND",
      raw: true,
    });
    return this;
  }

  // ==========================================================================
  // LIMIT AND OFFSET METHODS
  // ==========================================================================

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Alias for limit
   */
  take(count: number): this {
    return this.limit(count);
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Alias for offset
   */
  skip(count: number): this {
    return this.offset(count);
  }

  /**
   * Set limit and offset for a specific page
   */
  forPage(page: number, perPage: number = 15): this {
    return this.offset((page - 1) * perPage).limit(perPage);
  }

  // ==========================================================================
  // LOCKING METHODS
  // ==========================================================================

  /**
   * Lock rows for update
   */
  lockForUpdate(): this {
    this.forUpdateValue = true;
    return this;
  }

  /**
   * Lock rows for share
   */
  sharedLock(): this {
    this.forShareValue = true;
    return this;
  }

  /**
   * Skip locked rows
   */
  skipLocked(): this {
    this.skipLockedValue = true;
    return this;
  }

  /**
   * Don't wait for locks
   */
  noWait(): this {
    this.noWaitValue = true;
    return this;
  }

  // ==========================================================================
  // EAGER LOADING
  // ==========================================================================

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
   * Eager load relations with constraints
   */
  withCount(relation: string): this {
    // This is a simplified version - full implementation would use subqueries
    this.eagerLoads.push(`${relation}_count`);
    return this;
  }

  // ==========================================================================
  // EXECUTION METHODS
  // ==========================================================================

  /**
   * Execute query and get all results
   */
  async get(): Promise<T[]> {
    const options: SelectOptions = {
      columns: this.selectColumns,
      where: this.whereClauses,
      orderBy: this.orderByClauses,
      groupBy: this.groupByClauses.length > 0 ? this.groupByClauses : undefined,
      having: this.havingClauses.length > 0 ? this.havingClauses : undefined,
      limit: this.limitValue,
      offset: this.offsetValue,
      joins: this.joinClauses,
      distinct: this.distinctValue,
      forUpdate: this.forUpdateValue,
      forShare: this.forShareValue,
      skipLocked: this.skipLockedValue,
      noWait: this.noWaitValue,
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
   * Get first result or throw
   */
  async firstOrFail(): Promise<T> {
    const result = await this.first();
    if (!result) {
      throw new Error(`No record found in ${this.tableName}`);
    }
    return result;
  }

  /**
   * Find by ID
   */
  async find(id: any): Promise<T | null> {
    return this.where("id", id).first();
  }

  /**
   * Find by ID or throw
   */
  async findOrFail(id: any): Promise<T> {
    const result = await this.find(id);
    if (!result) {
      throw new Error(`No record found with id ${id} in ${this.tableName}`);
    }
    return result;
  }

  /**
   * Get a single column's value
   */
  async value(column: string): Promise<any> {
    const result = await this.select(column).first();
    return result ? (result as any)[column] : null;
  }

  /**
   * Get specific column values
   */
  async pluck(
    column: string,
    key?: string
  ): Promise<any[] | Record<string, any>> {
    this.select(key ? ([column, key] as any) : column);
    const results = await this.get();

    if (key) {
      const obj: Record<string, any> = {};
      results.forEach((row: any) => {
        obj[row[key]] = row[column];
      });
      return obj;
    }

    return results.map((row: any) => row[column]);
  }

  /**
   * Chunk results for processing large datasets
   */
  async chunk(
    count: number,
    callback: (items: T[], page: number) => Promise<boolean | void>
  ): Promise<void> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const results = await this.clone().forPage(page, count).get();

      if (results.length === 0) {
        break;
      }

      const shouldContinue = await callback(results, page);

      if (shouldContinue === false || results.length < count) {
        hasMore = false;
      }

      page++;
    }
  }

  /**
   * Chunk by ID for better performance
   */
  async chunkById(
    count: number,
    callback: (items: T[], page: number) => Promise<boolean | void>,
    column: string = "id"
  ): Promise<void> {
    let lastId: any = null;
    let page = 1;

    while (true) {
      const query = this.clone().orderBy(column).limit(count);

      if (lastId !== null) {
        query.where(column, ">", lastId);
      }

      const results = await query.get();

      if (results.length === 0) {
        break;
      }

      const shouldContinue = await callback(results, page);

      if (shouldContinue === false) {
        break;
      }

      lastId = (results[results.length - 1] as any)[column];
      page++;
    }
  }

  /**
   * Iterate over results lazily
   */
  async *cursor(): AsyncGenerator<T> {
    let page = 1;
    const perPage = 100;

    while (true) {
      const results = await this.clone().forPage(page, perPage).get();

      if (results.length === 0) {
        break;
      }

      for (const result of results) {
        yield result;
      }

      if (results.length < perPage) {
        break;
      }

      page++;
    }
  }

  // ==========================================================================
  // AGGREGATE METHODS
  // ==========================================================================

  /**
   * Count results
   */
  async count(column: string = "*"): Promise<number> {
    const query = this.clone();
    query.selectColumns = [`COUNT(${column}) as aggregate`];
    const result = await query.first();
    return result ? parseInt((result as any).aggregate || "0", 10) : 0;
  }

  /**
   * Sum of column
   */
  async sum(column: string): Promise<number> {
    const query = this.clone();
    query.selectColumns = [`SUM(${column}) as aggregate`];
    const result = await query.first();
    return result ? parseFloat((result as any).aggregate || "0") : 0;
  }

  /**
   * Average of column
   */
  async avg(column: string): Promise<number> {
    const query = this.clone();
    query.selectColumns = [`AVG(${column}) as aggregate`];
    const result = await query.first();
    return result ? parseFloat((result as any).aggregate || "0") : 0;
  }

  /**
   * Alias for avg
   */
  async average(column: string): Promise<number> {
    return this.avg(column);
  }

  /**
   * Minimum value of column
   */
  async min(column: string): Promise<any> {
    const query = this.clone();
    query.selectColumns = [`MIN(${column}) as aggregate`];
    const result = await query.first();
    return result ? (result as any).aggregate : null;
  }

  /**
   * Maximum value of column
   */
  async max(column: string): Promise<any> {
    const query = this.clone();
    query.selectColumns = [`MAX(${column}) as aggregate`];
    const result = await query.first();
    return result ? (result as any).aggregate : null;
  }

  // ==========================================================================
  // EXISTENCE METHODS
  // ==========================================================================

  /**
   * Check if any records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Check if no records exist
   */
  async doesntExist(): Promise<boolean> {
    return !(await this.exists());
  }

  // ==========================================================================
  // PAGINATION METHODS
  // ==========================================================================

  /**
   * Paginate results with offset pagination
   */
  async paginate(
    page: number = 1,
    perPage: number = 15
  ): Promise<PaginationResult<T>> {
    const countQuery = this.clone();
    const total = await countQuery.count();

    const offset = (page - 1) * perPage;
    this.limit(perPage).offset(offset);
    const data = await this.get();

    const lastPage = Math.ceil(total / perPage);
    const from = total > 0 ? offset + 1 : 0;
    const to = Math.min(offset + perPage, total);

    return {
      data,
      total,
      perPage,
      currentPage: page,
      lastPage,
      from,
      to,
      hasMorePages: page < lastPage,
      isEmpty: data.length === 0,
      isNotEmpty: data.length > 0,
    };
  }

  /**
   * Simple pagination without total count (faster)
   */
  async simplePaginate(
    page: number = 1,
    perPage: number = 15
  ): Promise<{
    data: T[];
    hasMore: boolean;
    currentPage: number;
    perPage: number;
  }> {
    this.limit(perPage + 1).offset((page - 1) * perPage);
    const results = await this.get();

    const hasMore = results.length > perPage;
    const data = hasMore ? results.slice(0, perPage) : results;

    return {
      data,
      hasMore,
      currentPage: page,
      perPage,
    };
  }

  /**
   * Cursor-based pagination
   */
  async cursorPaginate(
    cursor: string | null,
    perPage: number = 15,
    column: string = "id"
  ): Promise<CursorPaginationResult<T>> {
    this.orderBy(column, "ASC").limit(perPage + 1);

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString("utf8");
      const cursorValue = JSON.parse(decodedCursor);
      this.where(column, ">", cursorValue[column]);
    }

    const results = await this.get();
    const hasMore = results.length > perPage;
    const data = hasMore ? results.slice(0, perPage) : results;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1] as any;
      nextCursor = Buffer.from(
        JSON.stringify({ [column]: lastItem[column] })
      ).toString("base64");
    }

    let previousCursor: string | null = null;
    if (cursor && data.length > 0) {
      const firstItem = data[0] as any;
      previousCursor = Buffer.from(
        JSON.stringify({ [column]: firstItem[column] })
      ).toString("base64");
    }

    return {
      data,
      nextCursor,
      previousCursor,
      hasMore,
      perPage,
    };
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  /**
   * Insert a new record
   */
  async insert(data: Partial<T>): Promise<any> {
    return this.adapter.insert(this.tableName, data);
  }

  /**
   * Insert multiple records
   */
  async insertMany(data: Partial<T>[]): Promise<any[]> {
    if (this.adapter.insertMany) {
      return this.adapter.insertMany(this.tableName, data);
    }

    // Fallback to individual inserts
    const results: any[] = [];
    for (const item of data) {
      results.push(await this.adapter.insert(this.tableName, item));
    }
    return results;
  }

  /**
   * Update records matching current query
   */
  async update(data: Partial<T>): Promise<number> {
    if (this.adapter.updateMany && this.whereClauses.length > 0) {
      return this.adapter.updateMany(this.tableName, this.whereClauses, data);
    }

    // Fallback: get IDs and update individually
    const records = await this.get();
    let count = 0;
    for (const record of records) {
      await this.adapter.update(this.tableName, (record as any).id, data);
      count++;
    }
    return count;
  }

  /**
   * Delete records matching current query
   */
  async delete(): Promise<number> {
    if (this.adapter.deleteMany && this.whereClauses.length > 0) {
      return this.adapter.deleteMany(this.tableName, this.whereClauses);
    }

    // Fallback: get IDs and delete individually
    const records = await this.get();
    let count = 0;
    for (const record of records) {
      await this.adapter.delete(this.tableName, (record as any).id);
      count++;
    }
    return count;
  }

  /**
   * Insert or update a record
   */
  async upsert(data: Partial<T>, uniqueKeys: string[]): Promise<any> {
    if (this.adapter.upsert) {
      return this.adapter.upsert(this.tableName, data, uniqueKeys);
    }

    // Fallback: check existence and insert/update
    const query = this.clone();
    for (const key of uniqueKeys) {
      query.where(key, (data as any)[key]);
    }

    const existing = await query.first();
    if (existing) {
      return this.adapter.update(this.tableName, (existing as any).id, data);
    }
    return this.adapter.insert(this.tableName, data);
  }

  /**
   * Increment a column value
   */
  async increment(column: string, amount: number = 1): Promise<number> {
    const records = await this.get();
    let count = 0;
    for (const record of records) {
      const currentValue = (record as any)[column] || 0;
      await this.adapter.update(this.tableName, (record as any).id, {
        [column]: currentValue + amount,
      });
      count++;
    }
    return count;
  }

  /**
   * Decrement a column value
   */
  async decrement(column: string, amount: number = 1): Promise<number> {
    return this.increment(column, -amount);
  }

  // ==========================================================================
  // CLONE AND UTILITY METHODS
  // ==========================================================================

  /**
   * Clone the query builder
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>(this.tableName, this.adapter);
    cloned.selectColumns = [...this.selectColumns];
    cloned.whereClauses = JSON.parse(JSON.stringify(this.whereClauses));
    cloned.orderByClauses = [...this.orderByClauses];
    cloned.joinClauses = [...this.joinClauses];
    cloned.groupByClauses = [...this.groupByClauses];
    cloned.havingClauses = [...this.havingClauses];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.distinctValue = this.distinctValue;
    cloned.forUpdateValue = this.forUpdateValue;
    cloned.forShareValue = this.forShareValue;
    cloned.skipLockedValue = this.skipLockedValue;
    cloned.noWaitValue = this.noWaitValue;
    cloned.eagerLoads = [...this.eagerLoads];
    cloned.model = this.model;
    return cloned;
  }

  /**
   * Get the SQL representation (for debugging)
   */
  toSql(): { sql: string; bindings: any[] } {
    // This is a simplified representation
    let sql = `SELECT ${this.selectColumns.join(", ")} FROM ${this.tableName}`;
    const bindings: any[] = [];

    if (this.whereClauses.length > 0) {
      sql += " WHERE ";
      sql += this.whereClauses
        .map((c, i) => {
          const prefix = i === 0 ? "" : ` ${c.boolean} `;
          bindings.push(c.value);
          return `${prefix}${c.column} ${c.operator} ?`;
        })
        .join("");
    }

    if (this.orderByClauses.length > 0) {
      sql += ` ORDER BY ${this.orderByClauses
        .map((o) => `${o.column} ${o.direction}`)
        .join(", ")}`;
    }

    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, bindings };
  }

  /**
   * Dump the query for debugging
   */
  dump(): this {
    console.log(this.toSql());
    return this;
  }

  /**
   * Dump and die
   */
  dd(): never {
    console.log(this.toSql());
    process.exit(1);
  }
}
