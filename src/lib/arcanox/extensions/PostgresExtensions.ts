import { QueryBuilder } from "../QueryBuilder";

/**
 * PostgreSQL-specific extensions for QueryBuilder
 * Provides advanced PostgreSQL features like JSONB operations,
 * full-text search, window functions, and more
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface JsonPathOptions {
  path: string;
  vars?: Record<string, any>;
  silent?: boolean;
}

export interface FullTextSearchOptions {
  config?: string; // 'english', 'simple', etc.
  weights?: Record<string, "A" | "B" | "C" | "D">;
  highlight?: boolean;
  highlightOptions?: {
    startSel?: string;
    stopSel?: string;
    maxWords?: number;
    minWords?: number;
    shortWord?: number;
    maxFragments?: number;
  };
}

export interface WindowFunctionOptions {
  partitionBy?: string | string[];
  orderBy?: string | Array<{ column: string; direction: "ASC" | "DESC" }>;
  frame?: {
    type: "ROWS" | "RANGE" | "GROUPS";
    start: "UNBOUNDED PRECEDING" | "CURRENT ROW" | `${number} PRECEDING`;
    end?: "UNBOUNDED FOLLOWING" | "CURRENT ROW" | `${number} FOLLOWING`;
  };
}

export interface ArrayOperationOptions {
  operator: "@>" | "<@" | "&&" | "||";
}

export interface LateralJoinOptions {
  alias: string;
  query: string | QueryBuilder<any>;
  on?: string;
}

export interface CTEOptions {
  name: string;
  query: string | QueryBuilder<any>;
  recursive?: boolean;
  columns?: string[];
}

export interface UpsertOptions {
  conflictColumns: string[];
  updateColumns?: string[];
  where?: string;
  doNothing?: boolean;
}

export interface NotifyOptions {
  channel: string;
  payload?: string | Record<string, any>;
}

export interface RangeType {
  lower: number | Date | string;
  upper: number | Date | string;
  lowerInclusive?: boolean;
  upperInclusive?: boolean;
}

// ============================================================================
// JSONB Operations
// ============================================================================

/**
 * JSONB contains - Check if JSONB column contains value
 */
QueryBuilder.macro(
  "jsonbContains",
  function (
    this: QueryBuilder<any>,
    column: string,
    value: Record<string, any>
  ) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "@>",
      value: JSON.stringify(value),
      raw: true,
    });
    return this;
  }
);

/**
 * JSONB contained by - Check if value contains JSONB column
 */
QueryBuilder.macro(
  "jsonbContainedBy",
  function (
    this: QueryBuilder<any>,
    column: string,
    value: Record<string, any>
  ) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "<@",
      value: JSON.stringify(value),
      raw: true,
    });
    return this;
  }
);

/**
 * JSONB exists key - Check if key exists in JSONB column
 */
QueryBuilder.macro(
  "jsonbHasKey",
  function (this: QueryBuilder<any>, column: string, key: string) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "?",
      value: key,
      raw: true,
    });
    return this;
  }
);

/**
 * JSONB exists any key - Check if any key exists
 */
QueryBuilder.macro(
  "jsonbHasAnyKey",
  function (this: QueryBuilder<any>, column: string, keys: string[]) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "?|",
      value: `ARRAY[${keys.map((k) => `'${k}'`).join(",")}]`,
      raw: true,
    });
    return this;
  }
);

/**
 * JSONB exists all keys - Check if all keys exist
 */
QueryBuilder.macro(
  "jsonbHasAllKeys",
  function (this: QueryBuilder<any>, column: string, keys: string[]) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "?&",
      value: `ARRAY[${keys.map((k) => `'${k}'`).join(",")}]`,
      raw: true,
    });
    return this;
  }
);

/**
 * JSONB path query - Query using JSONPath
 */
QueryBuilder.macro(
  "jsonbPath",
  function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    vars?: Record<string, any>
  ) {
    const varsStr = vars ? `, '${JSON.stringify(vars)}'` : "";
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `jsonb_path_query(${column}, '${path}'${varsStr})`
    );
    return this;
  }
);

/**
 * JSONB path exists - Check if path exists
 */
QueryBuilder.macro(
  "jsonbPathExists",
  function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    vars?: Record<string, any>
  ) {
    const varsStr = vars ? `, '${JSON.stringify(vars)}'` : "";
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `jsonb_path_exists(${column}, '${path}'${varsStr})`,
      operator: "=",
      value: true,
      raw: true,
    });
    return this;
  }
);

/**
 * JSONB set - Update JSONB field at path
 */
QueryBuilder.macro(
  "jsonbSet",
  async function (
    this: QueryBuilder<any>,
    column: string,
    path: string[],
    value: any,
    createIfMissing: boolean = true
  ) {
    const pathStr = `'{${path.join(",")}}'`;
    const valueStr =
      typeof value === "string" ? `'"${value}"'` : `'${JSON.stringify(value)}'`;

    const sql = `UPDATE ${this.tableName} SET ${column} = jsonb_set(${column}, ${pathStr}, ${valueStr}, ${createIfMissing})`;

    return this.adapter.raw(sql);
  }
);

/**
 * JSONB delete key
 */
QueryBuilder.macro(
  "jsonbDeleteKey",
  async function (
    this: QueryBuilder<any>,
    column: string,
    key: string | string[]
  ) {
    const keyPart = Array.isArray(key)
      ? `#- '{${key.join(",")}}'`
      : `- '${key}'`;
    const sql = `UPDATE ${this.tableName} SET ${column} = ${column} ${keyPart}`;

    return this.adapter.raw(sql);
  }
);

/**
 * JSONB concat/merge
 */
QueryBuilder.macro(
  "jsonbMerge",
  async function (
    this: QueryBuilder<any>,
    column: string,
    value: Record<string, any>
  ) {
    const sql = `UPDATE ${
      this.tableName
    } SET ${column} = ${column} || '${JSON.stringify(value)}'`;

    return this.adapter.raw(sql);
  }
);

// ============================================================================
// Full-Text Search
// ============================================================================

/**
 * Full-text search using to_tsvector and to_tsquery
 */
QueryBuilder.macro(
  "fullTextSearch",
  function (
    this: QueryBuilder<any>,
    columns: string | string[],
    query: string,
    options?: FullTextSearchOptions
  ) {
    const config = options?.config || "english";
    const cols = Array.isArray(columns) ? columns : [columns];

    // Build tsvector
    let tsvector: string;
    if (options?.weights) {
      const weightedCols = cols.map((col) => {
        const weight = options.weights?.[col] || "D";
        return `setweight(to_tsvector('${config}', COALESCE(${col}, '')), '${weight}')`;
      });
      tsvector = weightedCols.join(" || ");
    } else {
      tsvector = cols
        .map((col) => `to_tsvector('${config}', COALESCE(${col}, ''))`)
        .join(" || ");
    }

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: tsvector,
      operator: "@@",
      value: `plainto_tsquery('${config}', '${query}')`,
      raw: true,
    });

    // Add ranking to select
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `ts_rank(${tsvector}, plainto_tsquery('${config}', '${query}')) as search_rank`
    );

    // Add highlight if requested
    if (options?.highlight) {
      const highlightOpts = options.highlightOptions || {};
      const optsStr = Object.entries(highlightOpts)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");

      cols.forEach((col) => {
        (this as any)._selectRaw.push(
          `ts_headline('${config}', ${col}, plainto_tsquery('${config}', '${query}')${
            optsStr ? `, '${optsStr}'` : ""
          }) as ${col}_highlighted`
        );
      });
    }

    return this;
  }
);

/**
 * Phrase search (exact phrase matching)
 */
QueryBuilder.macro(
  "phraseSearch",
  function (
    this: QueryBuilder<any>,
    columns: string | string[],
    phrase: string,
    config: string = "english"
  ) {
    const cols = Array.isArray(columns) ? columns : [columns];
    const tsvector = cols
      .map((col) => `to_tsvector('${config}', COALESCE(${col}, ''))`)
      .join(" || ");

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: tsvector,
      operator: "@@",
      value: `phraseto_tsquery('${config}', '${phrase}')`,
      raw: true,
    });

    return this;
  }
);

/**
 * Websearch-style search (Google-like syntax)
 */
QueryBuilder.macro(
  "websearch",
  function (
    this: QueryBuilder<any>,
    columns: string | string[],
    query: string,
    config: string = "english"
  ) {
    const cols = Array.isArray(columns) ? columns : [columns];
    const tsvector = cols
      .map((col) => `to_tsvector('${config}', COALESCE(${col}, ''))`)
      .join(" || ");

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: tsvector,
      operator: "@@",
      value: `websearch_to_tsquery('${config}', '${query}')`,
      raw: true,
    });

    return this;
  }
);

// ============================================================================
// Window Functions
// ============================================================================

/**
 * Add window function to select
 */
QueryBuilder.macro(
  "windowFunction",
  function (
    this: QueryBuilder<any>,
    func: string,
    alias: string,
    options: WindowFunctionOptions
  ) {
    let windowDef = "";

    if (options.partitionBy) {
      const partitions = Array.isArray(options.partitionBy)
        ? options.partitionBy.join(", ")
        : options.partitionBy;
      windowDef += `PARTITION BY ${partitions}`;
    }

    if (options.orderBy) {
      const orders =
        typeof options.orderBy === "string"
          ? options.orderBy
          : options.orderBy.map((o) => `${o.column} ${o.direction}`).join(", ");
      windowDef += (windowDef ? " " : "") + `ORDER BY ${orders}`;
    }

    if (options.frame) {
      windowDef += ` ${options.frame.type} BETWEEN ${options.frame.start}`;
      if (options.frame.end) {
        windowDef += ` AND ${options.frame.end}`;
      }
    }

    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(`${func} OVER (${windowDef}) as ${alias}`);

    return this;
  }
);

/**
 * Row number window function
 */
QueryBuilder.macro(
  "rowNumber",
  function (
    this: QueryBuilder<any>,
    alias: string = "row_num",
    options: WindowFunctionOptions = {}
  ) {
    return (this as any).windowFunction("ROW_NUMBER()", alias, options);
  }
);

/**
 * Rank window function
 */
QueryBuilder.macro(
  "rank",
  function (
    this: QueryBuilder<any>,
    alias: string = "rank",
    options: WindowFunctionOptions = {}
  ) {
    return (this as any).windowFunction("RANK()", alias, options);
  }
);

/**
 * Dense rank window function
 */
QueryBuilder.macro(
  "denseRank",
  function (
    this: QueryBuilder<any>,
    alias: string = "dense_rank",
    options: WindowFunctionOptions = {}
  ) {
    return (this as any).windowFunction("DENSE_RANK()", alias, options);
  }
);

/**
 * Lag window function
 */
QueryBuilder.macro(
  "lag",
  function (
    this: QueryBuilder<any>,
    column: string,
    offset: number = 1,
    defaultValue?: any,
    alias?: string,
    options: WindowFunctionOptions = {}
  ) {
    const func =
      defaultValue !== undefined
        ? `LAG(${column}, ${offset}, ${defaultValue})`
        : `LAG(${column}, ${offset})`;
    return (this as any).windowFunction(
      func,
      alias || `${column}_lag`,
      options
    );
  }
);

/**
 * Lead window function
 */
QueryBuilder.macro(
  "lead",
  function (
    this: QueryBuilder<any>,
    column: string,
    offset: number = 1,
    defaultValue?: any,
    alias?: string,
    options: WindowFunctionOptions = {}
  ) {
    const func =
      defaultValue !== undefined
        ? `LEAD(${column}, ${offset}, ${defaultValue})`
        : `LEAD(${column}, ${offset})`;
    return (this as any).windowFunction(
      func,
      alias || `${column}_lead`,
      options
    );
  }
);

/**
 * Running total
 */
QueryBuilder.macro(
  "runningTotal",
  function (
    this: QueryBuilder<any>,
    column: string,
    alias: string = "running_total",
    options: WindowFunctionOptions = {}
  ) {
    options.frame = options.frame || {
      type: "ROWS",
      start: "UNBOUNDED PRECEDING",
    };
    return (this as any).windowFunction(`SUM(${column})`, alias, options);
  }
);

/**
 * Moving average
 */
QueryBuilder.macro(
  "movingAverage",
  function (
    this: QueryBuilder<any>,
    column: string,
    windowSize: number,
    alias: string = "moving_avg",
    options: WindowFunctionOptions = {}
  ) {
    options.frame = {
      type: "ROWS",
      start: `${windowSize - 1} PRECEDING` as any,
      end: "CURRENT ROW",
    };
    return (this as any).windowFunction(`AVG(${column})`, alias, options);
  }
);

// ============================================================================
// Array Operations
// ============================================================================

/**
 * Array contains
 */
QueryBuilder.macro(
  "arrayContains",
  function (this: QueryBuilder<any>, column: string, values: any[]) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "@>",
      value: `ARRAY[${values
        .map((v) => (typeof v === "string" ? `'${v}'` : v))
        .join(",")}]`,
      raw: true,
    });
    return this;
  }
);

/**
 * Array is contained by
 */
QueryBuilder.macro(
  "arrayContainedBy",
  function (this: QueryBuilder<any>, column: string, values: any[]) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "<@",
      value: `ARRAY[${values
        .map((v) => (typeof v === "string" ? `'${v}'` : v))
        .join(",")}]`,
      raw: true,
    });
    return this;
  }
);

/**
 * Array overlap (has common elements)
 */
QueryBuilder.macro(
  "arrayOverlaps",
  function (this: QueryBuilder<any>, column: string, values: any[]) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "&&",
      value: `ARRAY[${values
        .map((v) => (typeof v === "string" ? `'${v}'` : v))
        .join(",")}]`,
      raw: true,
    });
    return this;
  }
);

/**
 * Array length
 */
QueryBuilder.macro(
  "arrayLength",
  function (
    this: QueryBuilder<any>,
    column: string,
    operator: string,
    value: number
  ) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `array_length(${column}, 1)`,
      operator,
      value,
      raw: true,
    });
    return this;
  }
);

/**
 * Unnest array (expand to rows)
 */
QueryBuilder.macro(
  "unnest",
  function (
    this: QueryBuilder<any>,
    column: string,
    alias: string = "unnested"
  ) {
    (this as any)._fromRaw = (this as any)._fromRaw || [];
    (this as any)._fromRaw.push(`unnest(${column}) as ${alias}`);
    return this;
  }
);

// ============================================================================
// Range Types
// ============================================================================

/**
 * Range contains value
 */
QueryBuilder.macro(
  "rangeContains",
  function (this: QueryBuilder<any>, column: string, value: any) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "@>",
      value: typeof value === "string" ? `'${value}'` : value,
      raw: true,
    });
    return this;
  }
);

/**
 * Range overlaps
 */
QueryBuilder.macro(
  "rangeOverlaps",
  function (this: QueryBuilder<any>, column: string, range: RangeType) {
    const lower = range.lowerInclusive ? "[" : "(";
    const upper = range.upperInclusive ? "]" : ")";
    const rangeStr = `'${lower}${range.lower},${range.upper}${upper}'`;

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "&&",
      value: rangeStr,
      raw: true,
    });
    return this;
  }
);

// ============================================================================
// Common Table Expressions (CTE)
// ============================================================================

/**
 * With CTE
 */
QueryBuilder.macro(
  "withCTE",
  function (
    this: QueryBuilder<any>,
    name: string,
    query: string,
    options?: { recursive?: boolean; columns?: string[] }
  ) {
    (this as any)._ctes = (this as any)._ctes || [];
    (this as any)._ctes.push({
      name,
      query,
      recursive: options?.recursive,
      columns: options?.columns,
    });
    return this;
  }
);

/**
 * Recursive CTE for hierarchical data
 */
QueryBuilder.macro(
  "withRecursive",
  function (
    this: QueryBuilder<any>,
    name: string,
    baseQuery: string,
    recursiveQuery: string,
    columns?: string[]
  ) {
    const fullQuery = `${baseQuery} UNION ALL ${recursiveQuery}`;
    (this as any)._ctes = (this as any)._ctes || [];
    (this as any)._ctes.push({
      name,
      query: fullQuery,
      recursive: true,
      columns,
    });
    return this;
  }
);

// ============================================================================
// Lateral Joins
// ============================================================================

/**
 * Lateral join
 */
QueryBuilder.macro(
  "joinLateral",
  function (
    this: QueryBuilder<any>,
    subquery: string,
    alias: string,
    on?: string
  ) {
    (this as any)._lateralJoins = (this as any)._lateralJoins || [];
    (this as any)._lateralJoins.push({
      type: "INNER",
      subquery,
      alias,
      on,
    });
    return this;
  }
);

/**
 * Left lateral join
 */
QueryBuilder.macro(
  "leftJoinLateral",
  function (
    this: QueryBuilder<any>,
    subquery: string,
    alias: string,
    on?: string
  ) {
    (this as any)._lateralJoins = (this as any)._lateralJoins || [];
    (this as any)._lateralJoins.push({
      type: "LEFT",
      subquery,
      alias,
      on,
    });
    return this;
  }
);

// ============================================================================
// Upsert (INSERT ... ON CONFLICT)
// ============================================================================

/**
 * Upsert - Insert or update on conflict
 */
QueryBuilder.macro(
  "upsertPg",
  async function (
    this: QueryBuilder<any>,
    data: Record<string, any> | Record<string, any>[],
    options: UpsertOptions
  ) {
    const records = Array.isArray(data) ? data : [data];
    const columns = Object.keys(records[0]);

    const values = records
      .map(
        (record) =>
          `(${columns
            .map((col) => {
              const val = record[col];
              if (val === null) return "NULL";
              if (typeof val === "string") return `'${val}'`;
              if (typeof val === "object") return `'${JSON.stringify(val)}'`;
              return val;
            })
            .join(", ")})`
      )
      .join(", ");

    let sql = `INSERT INTO ${this.tableName} (${columns.join(
      ", "
    )}) VALUES ${values}`;
    sql += ` ON CONFLICT (${options.conflictColumns.join(", ")})`;

    if (options.doNothing) {
      sql += " DO NOTHING";
    } else {
      const updateCols =
        options.updateColumns ||
        columns.filter((c) => !options.conflictColumns.includes(c));
      const updateSet = updateCols
        .map((col) => `${col} = EXCLUDED.${col}`)
        .join(", ");
      sql += ` DO UPDATE SET ${updateSet}`;

      if (options.where) {
        sql += ` WHERE ${options.where}`;
      }
    }

    sql += " RETURNING *";

    return this.adapter.raw(sql);
  }
);

// ============================================================================
// Listen/Notify
// ============================================================================

/**
 * Send notification
 */
QueryBuilder.macro(
  "notify",
  async function (
    this: QueryBuilder<any>,
    channel: string,
    payload?: string | Record<string, any>
  ) {
    const payloadStr = payload
      ? typeof payload === "string"
        ? payload
        : JSON.stringify(payload)
      : "";

    return this.adapter.raw(`NOTIFY ${channel}, '${payloadStr}'`);
  }
);

/**
 * Listen to channel (returns connection for listening)
 */
QueryBuilder.macro(
  "listen",
  async function (
    this: QueryBuilder<any>,
    channel: string,
    callback: (payload: any) => void
  ) {
    const client = await this.adapter.raw("client");
    await client.query(`LISTEN ${channel}`);

    client.on("notification", (msg: any) => {
      if (msg.channel === channel) {
        try {
          const payload = msg.payload ? JSON.parse(msg.payload) : msg.payload;
          callback(payload);
        } catch {
          callback(msg.payload);
        }
      }
    });

    return {
      unlisten: async () => {
        await client.query(`UNLISTEN ${channel}`);
      },
    };
  }
);

// ============================================================================
// Advisory Locks
// ============================================================================

/**
 * Acquire advisory lock
 */
QueryBuilder.macro(
  "advisoryLock",
  async function (
    this: QueryBuilder<any>,
    key: number,
    options?: { shared?: boolean; tryLock?: boolean }
  ) {
    const funcName = options?.shared
      ? options?.tryLock
        ? "pg_try_advisory_lock_shared"
        : "pg_advisory_lock_shared"
      : options?.tryLock
      ? "pg_try_advisory_lock"
      : "pg_advisory_lock";

    const result = await this.adapter.raw(`SELECT ${funcName}(${key})`);
    return options?.tryLock ? result[0][funcName] : true;
  }
);

/**
 * Release advisory lock
 */
QueryBuilder.macro(
  "advisoryUnlock",
  async function (this: QueryBuilder<any>, key: number, shared?: boolean) {
    const funcName = shared
      ? "pg_advisory_unlock_shared"
      : "pg_advisory_unlock";
    return this.adapter.raw(`SELECT ${funcName}(${key})`);
  }
);

// ============================================================================
// Table Inheritance
// ============================================================================

/**
 * Include inherited tables
 */
QueryBuilder.macro("includeInherited", function (this: QueryBuilder<any>) {
  (this as any)._includeInherited = true;
  return this;
});

/**
 * Only this table (exclude inherited)
 */
QueryBuilder.macro("excludeInherited", function (this: QueryBuilder<any>) {
  (this as any)._excludeInherited = true;
  return this;
});

// ============================================================================
// Explain and Analyze
// ============================================================================

/**
 * Explain query plan
 */
QueryBuilder.macro(
  "explainPg",
  async function (
    this: QueryBuilder<any>,
    options?: {
      analyze?: boolean;
      verbose?: boolean;
      costs?: boolean;
      buffers?: boolean;
      timing?: boolean;
      format?: "TEXT" | "XML" | "JSON" | "YAML";
    }
  ) {
    const opts: string[] = [];

    if (options?.analyze) opts.push("ANALYZE");
    if (options?.verbose) opts.push("VERBOSE");
    if (options?.costs !== false) opts.push("COSTS");
    if (options?.buffers) opts.push("BUFFERS");
    if (options?.timing) opts.push("TIMING");
    if (options?.format) opts.push(`FORMAT ${options.format}`);

    const optsStr = opts.length > 0 ? `(${opts.join(", ")})` : "";

    // Build the query that would be executed
    const query = await (this as any).toSQL();

    return this.adapter.raw(`EXPLAIN ${optsStr} ${query}`);
  }
);

// ============================================================================
// Materialized Views
// ============================================================================

/**
 * Refresh materialized view
 */
QueryBuilder.macro(
  "refreshMaterializedView",
  async function (
    this: QueryBuilder<any>,
    viewName: string,
    concurrent?: boolean
  ) {
    const concurrentStr = concurrent ? "CONCURRENTLY " : "";
    return this.adapter.raw(
      `REFRESH MATERIALIZED VIEW ${concurrentStr}${viewName}`
    );
  }
);

// ============================================================================
// TypeScript type augmentation
// ============================================================================

declare module "../QueryBuilder" {
  interface QueryBuilder<T> {
    // JSONB Operations
    jsonbContains(column: string, value: Record<string, any>): QueryBuilder<T>;
    jsonbContainedBy(
      column: string,
      value: Record<string, any>
    ): QueryBuilder<T>;
    jsonbHasKey(column: string, key: string): QueryBuilder<T>;
    jsonbHasAnyKey(column: string, keys: string[]): QueryBuilder<T>;
    jsonbHasAllKeys(column: string, keys: string[]): QueryBuilder<T>;
    jsonbPath(
      column: string,
      path: string,
      vars?: Record<string, any>
    ): QueryBuilder<T>;
    jsonbPathExists(
      column: string,
      path: string,
      vars?: Record<string, any>
    ): QueryBuilder<T>;
    jsonbSet(
      column: string,
      path: string[],
      value: any,
      createIfMissing?: boolean
    ): Promise<any>;
    jsonbDeleteKey(column: string, key: string | string[]): Promise<any>;
    jsonbMerge(column: string, value: Record<string, any>): Promise<any>;

    // Full-Text Search
    fullTextSearch(
      columns: string | string[],
      query: string,
      options?: FullTextSearchOptions
    ): QueryBuilder<T>;
    phraseSearch(
      columns: string | string[],
      phrase: string,
      config?: string
    ): QueryBuilder<T>;
    websearch(
      columns: string | string[],
      query: string,
      config?: string
    ): QueryBuilder<T>;

    // Window Functions
    windowFunction(
      func: string,
      alias: string,
      options: WindowFunctionOptions
    ): QueryBuilder<T>;
    rowNumber(alias?: string, options?: WindowFunctionOptions): QueryBuilder<T>;
    rank(alias?: string, options?: WindowFunctionOptions): QueryBuilder<T>;
    denseRank(alias?: string, options?: WindowFunctionOptions): QueryBuilder<T>;
    lag(
      column: string,
      offset?: number,
      defaultValue?: any,
      alias?: string,
      options?: WindowFunctionOptions
    ): QueryBuilder<T>;
    lead(
      column: string,
      offset?: number,
      defaultValue?: any,
      alias?: string,
      options?: WindowFunctionOptions
    ): QueryBuilder<T>;
    runningTotal(
      column: string,
      alias?: string,
      options?: WindowFunctionOptions
    ): QueryBuilder<T>;
    movingAverage(
      column: string,
      windowSize: number,
      alias?: string,
      options?: WindowFunctionOptions
    ): QueryBuilder<T>;

    // Array Operations
    arrayContains(column: string, values: any[]): QueryBuilder<T>;
    arrayContainedBy(column: string, values: any[]): QueryBuilder<T>;
    arrayOverlaps(column: string, values: any[]): QueryBuilder<T>;
    arrayLength(
      column: string,
      operator: string,
      value: number
    ): QueryBuilder<T>;
    unnest(column: string, alias?: string): QueryBuilder<T>;

    // Range Types
    rangeContains(column: string, value: any): QueryBuilder<T>;
    rangeOverlaps(column: string, range: RangeType): QueryBuilder<T>;

    // CTE
    withCTE(
      name: string,
      query: string,
      options?: { recursive?: boolean; columns?: string[] }
    ): QueryBuilder<T>;
    withRecursive(
      name: string,
      baseQuery: string,
      recursiveQuery: string,
      columns?: string[]
    ): QueryBuilder<T>;

    // Lateral Joins
    joinLateral(subquery: string, alias: string, on?: string): QueryBuilder<T>;
    leftJoinLateral(
      subquery: string,
      alias: string,
      on?: string
    ): QueryBuilder<T>;

    // Upsert
    upsertPg(
      data: Record<string, any> | Record<string, any>[],
      options: UpsertOptions
    ): Promise<T[]>;

    // Listen/Notify
    notify(
      channel: string,
      payload?: string | Record<string, any>
    ): Promise<void>;
    listen(
      channel: string,
      callback: (payload: any) => void
    ): Promise<{ unlisten: () => Promise<void> }>;

    // Advisory Locks
    advisoryLock(
      key: number,
      options?: { shared?: boolean; tryLock?: boolean }
    ): Promise<boolean>;
    advisoryUnlock(key: number, shared?: boolean): Promise<void>;

    // Inheritance
    includeInherited(): QueryBuilder<T>;
    excludeInherited(): QueryBuilder<T>;

    // Explain
    explainPg(options?: {
      analyze?: boolean;
      verbose?: boolean;
      costs?: boolean;
      buffers?: boolean;
      timing?: boolean;
      format?: "TEXT" | "XML" | "JSON" | "YAML";
    }): Promise<any>;

    // Materialized Views
    refreshMaterializedView(
      viewName: string,
      concurrent?: boolean
    ): Promise<void>;
  }
}
