import { QueryBuilder } from "../QueryBuilder";

/**
 * MySQL-specific extensions for QueryBuilder
 * Provides advanced MySQL features like JSON operations,
 * full-text search, spatial queries, and more
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MySQLFullTextOptions {
  mode?:
    | "NATURAL LANGUAGE"
    | "BOOLEAN"
    | "NATURAL LANGUAGE WITH QUERY EXPANSION"
    | "WITH QUERY EXPANSION";
}

export interface MySQLJsonTableOptions {
  columns: Array<{
    name: string;
    type: string;
    path: string;
    onEmpty?: "NULL" | "ERROR" | "DEFAULT";
    onError?: "NULL" | "ERROR" | "DEFAULT";
    defaultValue?: any;
  }>;
}

export interface MySQLSpatialOptions {
  srid?: number;
}

export interface MySQLPartitionOptions {
  type: "RANGE" | "LIST" | "HASH" | "KEY";
  expression: string;
  partitions?: number;
}

export interface MySQLInsertOptions {
  ignore?: boolean;
  onDuplicateKeyUpdate?: Record<string, any> | string[];
  replace?: boolean;
}

export interface MySQLLockOptions {
  mode: "SHARED" | "EXCLUSIVE";
  tables?: string[];
  nowait?: boolean;
  skipLocked?: boolean;
}

export interface MySQLGroupConcatOptions {
  separator?: string;
  orderBy?: string | Array<{ column: string; direction: "ASC" | "DESC" }>;
  distinct?: boolean;
  limit?: number;
}

// ============================================================================
// JSON Operations
// ============================================================================

/**
 * JSON extract - Get value at path
 */
QueryBuilder.macro(
  "jsonExtract",
  function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    alias?: string
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `JSON_EXTRACT(${column}, '${pathStr}')${alias ? ` as ${alias}` : ""}`
    );
    return this;
  }
);

/**
 * JSON unquote extract (->>) - Get unquoted value
 */
QueryBuilder.macro(
  "jsonUnquote",
  function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    alias?: string
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `JSON_UNQUOTE(JSON_EXTRACT(${column}, '${pathStr}'))${
        alias ? ` as ${alias}` : ""
      }`
    );
    return this;
  }
);

/**
 * JSON contains - Check if JSON contains value
 */
QueryBuilder.macro(
  "jsonContainsMysql",
  function (
    this: QueryBuilder<any>,
    column: string,
    value: any,
    path?: string
  ) {
    const pathStr = path
      ? `, '${path.startsWith("$") ? path : `$.${path}`}'`
      : "";
    const valueStr =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `JSON_CONTAINS(${column}, '${valueStr}'${pathStr})`,
      operator: "=",
      value: 1,
      raw: true,
    });
    return this;
  }
);

/**
 * JSON contains path - Check if path exists
 */
QueryBuilder.macro(
  "jsonContainsPath",
  function (
    this: QueryBuilder<any>,
    column: string,
    paths: string[],
    mode: "one" | "all" = "one"
  ) {
    const pathsStr = paths
      .map((p) => `'${p.startsWith("$") ? p : `$.${p}`}'`)
      .join(", ");

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `JSON_CONTAINS_PATH(${column}, '${mode}', ${pathsStr})`,
      operator: "=",
      value: 1,
      raw: true,
    });
    return this;
  }
);

/**
 * JSON set - Set value at path
 */
QueryBuilder.macro(
  "jsonSet",
  async function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    value: any
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    const valueStr =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);

    const sql = `UPDATE ${this.tableName} SET ${column} = JSON_SET(${column}, '${pathStr}', ${valueStr})`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON insert - Insert value at path (only if not exists)
 */
QueryBuilder.macro(
  "jsonInsert",
  async function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    value: any
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    const valueStr =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);

    const sql = `UPDATE ${this.tableName} SET ${column} = JSON_INSERT(${column}, '${pathStr}', ${valueStr})`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON replace - Replace value at path (only if exists)
 */
QueryBuilder.macro(
  "jsonReplace",
  async function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    value: any
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    const valueStr =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);

    const sql = `UPDATE ${this.tableName} SET ${column} = JSON_REPLACE(${column}, '${pathStr}', ${valueStr})`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON remove - Remove value at path
 */
QueryBuilder.macro(
  "jsonRemove",
  async function (this: QueryBuilder<any>, column: string, path: string) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;

    const sql = `UPDATE ${this.tableName} SET ${column} = JSON_REMOVE(${column}, '${pathStr}')`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON merge patch - Merge JSON values (RFC 7396)
 */
QueryBuilder.macro(
  "jsonMergePatch",
  async function (
    this: QueryBuilder<any>,
    column: string,
    value: Record<string, any>
  ) {
    const sql = `UPDATE ${
      this.tableName
    } SET ${column} = JSON_MERGE_PATCH(${column}, '${JSON.stringify(value)}')`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON array append
 */
QueryBuilder.macro(
  "jsonArrayAppend",
  async function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    value: any
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    const valueStr =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);

    const sql = `UPDATE ${this.tableName} SET ${column} = JSON_ARRAY_APPEND(${column}, '${pathStr}', ${valueStr})`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON array insert
 */
QueryBuilder.macro(
  "jsonArrayInsert",
  async function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    value: any
  ) {
    const pathStr = path.startsWith("$") ? path : `$.${path}`;
    const valueStr =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);

    const sql = `UPDATE ${this.tableName} SET ${column} = JSON_ARRAY_INSERT(${column}, '${pathStr}', ${valueStr})`;
    return this.adapter.raw(sql);
  }
);

/**
 * JSON table - Convert JSON to relational table
 */
QueryBuilder.macro(
  "jsonTable",
  function (
    this: QueryBuilder<any>,
    column: string,
    path: string,
    options: MySQLJsonTableOptions,
    alias: string = "jt"
  ) {
    const columnsStr = options.columns
      .map((col) => {
        let colDef = `${col.name} ${col.type} PATH '${col.path}'`;
        if (col.onEmpty) colDef += ` ${col.onEmpty} ON EMPTY`;
        if (col.onError) colDef += ` ${col.onError} ON ERROR`;
        if (col.defaultValue !== undefined)
          colDef += ` DEFAULT '${col.defaultValue}'`;
        return colDef;
      })
      .join(", ");

    const pathStr = path.startsWith("$") ? path : `$.${path}`;

    (this as any)._fromRaw = (this as any)._fromRaw || [];
    (this as any)._fromRaw.push(
      `JSON_TABLE(${column}, '${pathStr}' COLUMNS(${columnsStr})) as ${alias}`
    );

    return this;
  }
);

// ============================================================================
// Full-Text Search
// ============================================================================

/**
 * Full-text search with MATCH...AGAINST
 */
QueryBuilder.macro(
  "matchAgainst",
  function (
    this: QueryBuilder<any>,
    columns: string | string[],
    query: string,
    options?: MySQLFullTextOptions
  ) {
    const cols = Array.isArray(columns) ? columns.join(", ") : columns;
    const mode = options?.mode || "NATURAL LANGUAGE";

    const matchExpr = `MATCH(${cols}) AGAINST('${query}' IN ${mode} MODE)`;

    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: matchExpr,
      operator: ">",
      value: 0,
      raw: true,
    });

    // Add relevance score to select
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(`${matchExpr} as relevance_score`);

    return this;
  }
);

/**
 * Boolean full-text search
 */
QueryBuilder.macro(
  "booleanSearch",
  function (
    this: QueryBuilder<any>,
    columns: string | string[],
    query: string
  ) {
    return (this as any).matchAgainst(columns, query, { mode: "BOOLEAN" });
  }
);

/**
 * Full-text search with query expansion
 */
QueryBuilder.macro(
  "searchWithExpansion",
  function (
    this: QueryBuilder<any>,
    columns: string | string[],
    query: string
  ) {
    return (this as any).matchAgainst(columns, query, {
      mode: "WITH QUERY EXPANSION",
    });
  }
);

// ============================================================================
// Spatial/Geometry Operations
// ============================================================================

/**
 * ST_Distance - Calculate distance between geometries
 */
QueryBuilder.macro(
  "stDistance",
  function (
    this: QueryBuilder<any>,
    column: string,
    point: [number, number],
    alias: string = "distance",
    srid?: number
  ) {
    const sridStr = srid ? `, ${srid}` : "";
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `ST_Distance(${column}, ST_GeomFromText('POINT(${point[0]} ${point[1]})'${sridStr})) as ${alias}`
    );
    return this;
  }
);

/**
 * ST_Distance_Sphere - Calculate spherical distance (for GPS coordinates)
 */
QueryBuilder.macro(
  "stDistanceSphere",
  function (
    this: QueryBuilder<any>,
    column: string,
    point: [number, number],
    alias: string = "distance_meters"
  ) {
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `ST_Distance_Sphere(${column}, ST_GeomFromText('POINT(${point[0]} ${point[1]})')) as ${alias}`
    );
    return this;
  }
);

/**
 * ST_Within - Check if geometry is within another
 */
QueryBuilder.macro(
  "stWithin",
  function (this: QueryBuilder<any>, column: string, geometry: string) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `ST_Within(${column}, ST_GeomFromText('${geometry}'))`,
      operator: "=",
      value: 1,
      raw: true,
    });
    return this;
  }
);

/**
 * ST_Contains - Check if geometry contains another
 */
QueryBuilder.macro(
  "stContains",
  function (this: QueryBuilder<any>, column: string, geometry: string) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `ST_Contains(${column}, ST_GeomFromText('${geometry}'))`,
      operator: "=",
      value: 1,
      raw: true,
    });
    return this;
  }
);

/**
 * ST_Intersects - Check if geometries intersect
 */
QueryBuilder.macro(
  "stIntersects",
  function (this: QueryBuilder<any>, column: string, geometry: string) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column: `ST_Intersects(${column}, ST_GeomFromText('${geometry}'))`,
      operator: "=",
      value: 1,
      raw: true,
    });
    return this;
  }
);

/**
 * Near point - Find records near a point
 */
QueryBuilder.macro(
  "nearPoint",
  function (
    this: QueryBuilder<any>,
    column: string,
    lat: number,
    lng: number,
    maxDistanceMeters?: number
  ) {
    // Add distance calculation
    (this as any).stDistanceSphere(column, [lng, lat], "distance");

    // Filter by max distance if provided
    if (maxDistanceMeters) {
      (this as any).whereClauses = (this as any).whereClauses || [];
      (this as any).whereClauses.push({
        column: `ST_Distance_Sphere(${column}, ST_GeomFromText('POINT(${lng} ${lat})'))`,
        operator: "<=",
        value: maxDistanceMeters,
        raw: true,
      });
    }

    // Order by distance
    (this as any)._orderByRaw = (this as any)._orderByRaw || [];
    (this as any)._orderByRaw.push(
      `ST_Distance_Sphere(${column}, ST_GeomFromText('POINT(${lng} ${lat})')) ASC`
    );

    return this;
  }
);

// ============================================================================
// Insert Variations
// ============================================================================

/**
 * INSERT IGNORE - Ignore duplicate key errors
 */
QueryBuilder.macro(
  "insertIgnore",
  async function (
    this: QueryBuilder<any>,
    data: Record<string, any> | Record<string, any>[]
  ) {
    const records = Array.isArray(data) ? data : [data];
    const columns = Object.keys(records[0]);

    const values = records
      .map(
        (record) =>
          `(${columns
            .map((col) => {
              const val = record[col];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "string")
                return `'${val.replace(/'/g, "\\'")}'`;
              if (typeof val === "object") return `'${JSON.stringify(val)}'`;
              if (typeof val === "boolean") return val ? 1 : 0;
              return val;
            })
            .join(", ")})`
      )
      .join(", ");

    const sql = `INSERT IGNORE INTO ${this.tableName} (${columns.join(
      ", "
    )}) VALUES ${values}`;
    return this.adapter.raw(sql);
  }
);

/**
 * INSERT ... ON DUPLICATE KEY UPDATE
 */
QueryBuilder.macro(
  "insertOrUpdate",
  async function (
    this: QueryBuilder<any>,
    data: Record<string, any> | Record<string, any>[],
    updateColumns?: string[]
  ) {
    const records = Array.isArray(data) ? data : [data];
    const columns = Object.keys(records[0]);

    const values = records
      .map(
        (record) =>
          `(${columns
            .map((col) => {
              const val = record[col];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "string")
                return `'${val.replace(/'/g, "\\'")}'`;
              if (typeof val === "object") return `'${JSON.stringify(val)}'`;
              if (typeof val === "boolean") return val ? 1 : 0;
              return val;
            })
            .join(", ")})`
      )
      .join(", ");

    const updateCols = updateColumns || columns;
    const updatePart = updateCols
      .map((col) => `${col} = VALUES(${col})`)
      .join(", ");

    const sql = `INSERT INTO ${this.tableName} (${columns.join(
      ", "
    )}) VALUES ${values} ON DUPLICATE KEY UPDATE ${updatePart}`;
    return this.adapter.raw(sql);
  }
);

/**
 * REPLACE INTO - Delete and re-insert if exists
 */
QueryBuilder.macro(
  "replaceInto",
  async function (
    this: QueryBuilder<any>,
    data: Record<string, any> | Record<string, any>[]
  ) {
    const records = Array.isArray(data) ? data : [data];
    const columns = Object.keys(records[0]);

    const values = records
      .map(
        (record) =>
          `(${columns
            .map((col) => {
              const val = record[col];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "string")
                return `'${val.replace(/'/g, "\\'")}'`;
              if (typeof val === "object") return `'${JSON.stringify(val)}'`;
              if (typeof val === "boolean") return val ? 1 : 0;
              return val;
            })
            .join(", ")})`
      )
      .join(", ");

    const sql = `REPLACE INTO ${this.tableName} (${columns.join(
      ", "
    )}) VALUES ${values}`;
    return this.adapter.raw(sql);
  }
);

// ============================================================================
// Locking
// ============================================================================

/**
 * Lock tables
 */
QueryBuilder.macro(
  "lockTables",
  async function (
    this: QueryBuilder<any>,
    tables: Array<{ name: string; mode: "READ" | "WRITE" }>
  ) {
    const lockStr = tables.map((t) => `${t.name} ${t.mode}`).join(", ");
    return this.adapter.raw(`LOCK TABLES ${lockStr}`);
  }
);

/**
 * Unlock tables
 */
QueryBuilder.macro("unlockTables", async function (this: QueryBuilder<any>) {
  return this.adapter.raw("UNLOCK TABLES");
});

/**
 * FOR UPDATE with options
 */
QueryBuilder.macro(
  "forUpdateMysql",
  function (
    this: QueryBuilder<any>,
    options?: { nowait?: boolean; skipLocked?: boolean; of?: string[] }
  ) {
    let lockStr = "FOR UPDATE";

    if (options?.of && options.of.length > 0) {
      lockStr += ` OF ${options.of.join(", ")}`;
    }

    if (options?.nowait) {
      lockStr += " NOWAIT";
    } else if (options?.skipLocked) {
      lockStr += " SKIP LOCKED";
    }

    (this as any)._lockMode = lockStr;
    return this;
  }
);

/**
 * FOR SHARE
 */
QueryBuilder.macro(
  "forShare",
  function (
    this: QueryBuilder<any>,
    options?: { nowait?: boolean; skipLocked?: boolean }
  ) {
    let lockStr = "FOR SHARE";

    if (options?.nowait) {
      lockStr += " NOWAIT";
    } else if (options?.skipLocked) {
      lockStr += " SKIP LOCKED";
    }

    (this as any)._lockMode = lockStr;
    return this;
  }
);

// ============================================================================
// String Functions
// ============================================================================

/**
 * GROUP_CONCAT - Aggregate strings
 */
QueryBuilder.macro(
  "groupConcat",
  function (
    this: QueryBuilder<any>,
    column: string,
    alias: string,
    options?: MySQLGroupConcatOptions
  ) {
    let func = "GROUP_CONCAT(";

    if (options?.distinct) {
      func += "DISTINCT ";
    }

    func += column;

    if (options?.orderBy) {
      const orderStr =
        typeof options.orderBy === "string"
          ? options.orderBy
          : options.orderBy.map((o) => `${o.column} ${o.direction}`).join(", ");
      func += ` ORDER BY ${orderStr}`;
    }

    if (options?.separator) {
      func += ` SEPARATOR '${options.separator}'`;
    }

    func += ")";

    if (options?.limit) {
      func = `SUBSTRING_INDEX(${func}, '${options?.separator || ","}', ${
        options.limit
      })`;
    }

    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(`${func} as ${alias}`);

    return this;
  }
);

/**
 * REGEXP - Regular expression matching
 */
QueryBuilder.macro(
  "regexp",
  function (this: QueryBuilder<any>, column: string, pattern: string) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "REGEXP",
      value: pattern,
      raw: true,
    });
    return this;
  }
);

/**
 * NOT REGEXP
 */
QueryBuilder.macro(
  "notRegexp",
  function (this: QueryBuilder<any>, column: string, pattern: string) {
    (this as any).whereClauses = (this as any).whereClauses || [];
    (this as any).whereClauses.push({
      column,
      operator: "NOT REGEXP",
      value: pattern,
      raw: true,
    });
    return this;
  }
);

// ============================================================================
// Date/Time Functions
// ============================================================================

/**
 * Date difference
 */
QueryBuilder.macro(
  "dateDiff",
  function (
    this: QueryBuilder<any>,
    column1: string,
    column2: string | Date,
    alias: string = "date_diff"
  ) {
    const col2 =
      column2 instanceof Date
        ? `'${column2.toISOString().split("T")[0]}'`
        : column2;

    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(`DATEDIFF(${column1}, ${col2}) as ${alias}`);

    return this;
  }
);

/**
 * Date add
 */
QueryBuilder.macro(
  "dateAdd",
  function (
    this: QueryBuilder<any>,
    column: string,
    interval: number,
    unit: "DAY" | "WEEK" | "MONTH" | "YEAR" | "HOUR" | "MINUTE" | "SECOND",
    alias?: string
  ) {
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `DATE_ADD(${column}, INTERVAL ${interval} ${unit})${
        alias ? ` as ${alias}` : ""
      }`
    );
    return this;
  }
);

/**
 * Date format
 */
QueryBuilder.macro(
  "dateFormat",
  function (
    this: QueryBuilder<any>,
    column: string,
    format: string,
    alias?: string
  ) {
    (this as any)._selectRaw = (this as any)._selectRaw || [];
    (this as any)._selectRaw.push(
      `DATE_FORMAT(${column}, '${format}')${alias ? ` as ${alias}` : ""}`
    );
    return this;
  }
);

// ============================================================================
// Partitioning
// ============================================================================

/**
 * Query specific partition
 */
QueryBuilder.macro(
  "partition",
  function (this: QueryBuilder<any>, partitionNames: string | string[]) {
    const partitions = Array.isArray(partitionNames)
      ? partitionNames.join(", ")
      : partitionNames;
    (this as any)._partition = partitions;
    return this;
  }
);

// ============================================================================
// Variables
// ============================================================================

/**
 * Set session variable
 */
QueryBuilder.macro(
  "setVariable",
  async function (this: QueryBuilder<any>, name: string, value: any) {
    const valueStr = typeof value === "string" ? `'${value}'` : value;
    return this.adapter.raw(`SET @${name} = ${valueStr}`);
  }
);

/**
 * Get session variable
 */
QueryBuilder.macro(
  "getVariable",
  async function (this: QueryBuilder<any>, name: string) {
    const result = await this.adapter.raw(`SELECT @${name} as value`);
    return result[0]?.value;
  }
);

// ============================================================================
// Explain and Analyze
// ============================================================================

/**
 * Explain query
 */
QueryBuilder.macro(
  "explainMysql",
  async function (
    this: QueryBuilder<any>,
    options?: { format?: "TRADITIONAL" | "JSON" | "TREE"; analyze?: boolean }
  ) {
    let explainStr = "EXPLAIN";

    if (options?.analyze) {
      explainStr += " ANALYZE";
    }

    if (options?.format) {
      explainStr += ` FORMAT=${options.format}`;
    }

    const query = await (this as any).toSQL();
    return this.adapter.raw(`${explainStr} ${query}`);
  }
);

// ============================================================================
// Optimizer Hints
// ============================================================================

/**
 * Add optimizer hint
 */
QueryBuilder.macro("hint", function (this: QueryBuilder<any>, hint: string) {
  (this as any)._hints = (this as any)._hints || [];
  (this as any)._hints.push(hint);
  return this;
});

/**
 * Use index hint
 */
QueryBuilder.macro(
  "useIndex",
  function (this: QueryBuilder<any>, indexes: string | string[]) {
    const idxStr = Array.isArray(indexes) ? indexes.join(", ") : indexes;
    (this as any)._indexHints = (this as any)._indexHints || [];
    (this as any)._indexHints.push(`USE INDEX (${idxStr})`);
    return this;
  }
);

/**
 * Force index hint
 */
QueryBuilder.macro(
  "forceIndex",
  function (this: QueryBuilder<any>, indexes: string | string[]) {
    const idxStr = Array.isArray(indexes) ? indexes.join(", ") : indexes;
    (this as any)._indexHints = (this as any)._indexHints || [];
    (this as any)._indexHints.push(`FORCE INDEX (${idxStr})`);
    return this;
  }
);

/**
 * Ignore index hint
 */
QueryBuilder.macro(
  "ignoreIndex",
  function (this: QueryBuilder<any>, indexes: string | string[]) {
    const idxStr = Array.isArray(indexes) ? indexes.join(", ") : indexes;
    (this as any)._indexHints = (this as any)._indexHints || [];
    (this as any)._indexHints.push(`IGNORE INDEX (${idxStr})`);
    return this;
  }
);

// ============================================================================
// High Availability
// ============================================================================

/**
 * SQL_CALC_FOUND_ROWS - Calculate total rows
 */
QueryBuilder.macro("calcFoundRows", function (this: QueryBuilder<any>) {
  (this as any)._sqlCalcFoundRows = true;
  return this;
});

/**
 * Get FOUND_ROWS() after calcFoundRows query
 */
QueryBuilder.macro("getFoundRows", async function (this: QueryBuilder<any>) {
  const result = await this.adapter.raw("SELECT FOUND_ROWS() as total");
  return result[0]?.total || 0;
});

// ============================================================================
// TypeScript type augmentation
// ============================================================================

declare module "../QueryBuilder" {
  interface QueryBuilder<T> {
    // JSON Operations
    jsonExtract(column: string, path: string, alias?: string): QueryBuilder<T>;
    jsonUnquote(column: string, path: string, alias?: string): QueryBuilder<T>;
    jsonContainsMysql(
      column: string,
      value: any,
      path?: string
    ): QueryBuilder<T>;
    jsonContainsPath(
      column: string,
      paths: string[],
      mode?: "one" | "all"
    ): QueryBuilder<T>;
    jsonSet(column: string, path: string, value: any): Promise<any>;
    jsonInsert(column: string, path: string, value: any): Promise<any>;
    jsonReplace(column: string, path: string, value: any): Promise<any>;
    jsonRemove(column: string, path: string): Promise<any>;
    jsonMergePatch(column: string, value: Record<string, any>): Promise<any>;
    jsonArrayAppend(column: string, path: string, value: any): Promise<any>;
    jsonArrayInsert(column: string, path: string, value: any): Promise<any>;
    jsonTable(
      column: string,
      path: string,
      options: MySQLJsonTableOptions,
      alias?: string
    ): QueryBuilder<T>;

    // Full-Text Search
    matchAgainst(
      columns: string | string[],
      query: string,
      options?: MySQLFullTextOptions
    ): QueryBuilder<T>;
    booleanSearch(columns: string | string[], query: string): QueryBuilder<T>;
    searchWithExpansion(
      columns: string | string[],
      query: string
    ): QueryBuilder<T>;

    // Spatial Operations
    stDistance(
      column: string,
      point: [number, number],
      alias?: string,
      srid?: number
    ): QueryBuilder<T>;
    stDistanceSphere(
      column: string,
      point: [number, number],
      alias?: string
    ): QueryBuilder<T>;
    stWithin(column: string, geometry: string): QueryBuilder<T>;
    stContains(column: string, geometry: string): QueryBuilder<T>;
    stIntersects(column: string, geometry: string): QueryBuilder<T>;
    nearPoint(
      column: string,
      lat: number,
      lng: number,
      maxDistanceMeters?: number
    ): QueryBuilder<T>;

    // Insert Variations
    insertIgnore(
      data: Record<string, any> | Record<string, any>[]
    ): Promise<any>;
    insertOrUpdate(
      data: Record<string, any> | Record<string, any>[],
      updateColumns?: string[]
    ): Promise<any>;
    replaceInto(
      data: Record<string, any> | Record<string, any>[]
    ): Promise<any>;

    // Locking
    lockTables(
      tables: Array<{ name: string; mode: "READ" | "WRITE" }>
    ): Promise<void>;
    unlockTables(): Promise<void>;
    forUpdateMysql(options?: {
      nowait?: boolean;
      skipLocked?: boolean;
      of?: string[];
    }): QueryBuilder<T>;
    forShare(options?: {
      nowait?: boolean;
      skipLocked?: boolean;
    }): QueryBuilder<T>;

    // String Functions
    groupConcat(
      column: string,
      alias: string,
      options?: MySQLGroupConcatOptions
    ): QueryBuilder<T>;
    regexp(column: string, pattern: string): QueryBuilder<T>;
    notRegexp(column: string, pattern: string): QueryBuilder<T>;

    // Date/Time Functions
    dateDiff(
      column1: string,
      column2: string | Date,
      alias?: string
    ): QueryBuilder<T>;
    dateAdd(
      column: string,
      interval: number,
      unit: "DAY" | "WEEK" | "MONTH" | "YEAR" | "HOUR" | "MINUTE" | "SECOND",
      alias?: string
    ): QueryBuilder<T>;
    dateFormat(column: string, format: string, alias?: string): QueryBuilder<T>;

    // Partitioning
    partition(partitionNames: string | string[]): QueryBuilder<T>;

    // Variables
    setVariable(name: string, value: any): Promise<void>;
    getVariable(name: string): Promise<any>;

    // Explain
    explainMysql(options?: {
      format?: "TRADITIONAL" | "JSON" | "TREE";
      analyze?: boolean;
    }): Promise<any>;

    // Optimizer Hints
    hint(hint: string): QueryBuilder<T>;
    useIndex(indexes: string | string[]): QueryBuilder<T>;
    forceIndex(indexes: string | string[]): QueryBuilder<T>;
    ignoreIndex(indexes: string | string[]): QueryBuilder<T>;

    // High Availability
    calcFoundRows(): QueryBuilder<T>;
    getFoundRows(): Promise<number>;
  }
}
