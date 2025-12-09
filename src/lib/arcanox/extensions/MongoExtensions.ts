import { QueryBuilder } from "../QueryBuilder";

/**
 * MongoDB-specific extensions for QueryBuilder
 * These extensions provide Mongoose-style functionality for MongoDB
 * Professional features for aggregation, population, and advanced queries
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PopulateOptions {
  from?: string;
  localField?: string;
  foreignField?: string;
  as?: string;
  select?: string[];
  match?: Record<string, any>;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  populate?: PopulateOptions[];
}

export interface LookupStage {
  $lookup: {
    from: string;
    localField?: string;
    foreignField?: string;
    as: string;
    let?: Record<string, any>;
    pipeline?: any[];
  };
}

export interface GeoNearOptions {
  near: {
    type: "Point";
    coordinates: [number, number];
  };
  distanceField: string;
  spherical?: boolean;
  maxDistance?: number;
  minDistance?: number;
  query?: Record<string, any>;
  includeLocs?: string;
  key?: string;
}

export interface BucketOptions {
  groupBy: string;
  boundaries: number[];
  default?: string | number;
  output?: Record<string, any>;
}

export interface BucketAutoOptions {
  groupBy: string;
  buckets: number;
  output?: Record<string, any>;
  granularity?:
    | "R5"
    | "R10"
    | "R20"
    | "R40"
    | "R80"
    | "1-2-5"
    | "E6"
    | "E12"
    | "E24"
    | "E48"
    | "E96"
    | "E192"
    | "POWERSOF2";
}

export interface FacetOptions {
  [key: string]: any[];
}

export interface GraphLookupOptions {
  from: string;
  startWith: string;
  connectFromField: string;
  connectToField: string;
  as: string;
  maxDepth?: number;
  depthField?: string;
  restrictSearchWithMatch?: Record<string, any>;
}

export interface TextSearchOptions {
  search: string;
  language?: string;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
}

export interface ChangeStreamOptions {
  fullDocument?: "default" | "updateLookup" | "whenAvailable" | "required";
  resumeAfter?: any;
  startAfter?: any;
  startAtOperationTime?: any;
}

// ============================================================================
// Core Mongoose-style Extensions
// ============================================================================

/**
 * Populate (Mongoose-style relationships)
 * Uses MongoDB's $lookup aggregation to join collections
 * Supports nested population
 */
QueryBuilder.macro(
  "populate",
  async function (
    this: QueryBuilder<any>,
    field: string,
    options?: PopulateOptions
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const relatedCollection = options?.from || `${field}s`;
    const localField = options?.localField || `${field}_id`;
    const foreignField = options?.foreignField || "_id";
    const as = options?.as || field;

    const pipeline: any[] = [];

    // Add existing where clauses as $match
    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    // Build $lookup with advanced options
    if (options?.select || options?.match || options?.limit || options?.sort) {
      const nestedPipeline: any[] = [];

      // Add match condition
      if (options.match) {
        nestedPipeline.push({ $match: options.match });
      }

      // Add expression match
      nestedPipeline.unshift({
        $match: { $expr: { $eq: [`$${foreignField}`, "$$localId"] } },
      });

      // Add sort
      if (options.sort) {
        nestedPipeline.push({ $sort: options.sort });
      }

      // Add limit
      if (options.limit) {
        nestedPipeline.push({ $limit: options.limit });
      }

      // Add projection
      if (options.select && options.select.length > 0) {
        const projection: any = {};
        options.select.forEach((f) => {
          projection[f] = 1;
        });
        nestedPipeline.push({ $project: projection });
      }

      // Handle nested population
      if (options.populate && options.populate.length > 0) {
        for (const nested of options.populate) {
          const nestedFrom = nested.from || `${nested.as}s`;
          const nestedLocalField = nested.localField || `${nested.as}_id`;
          const nestedForeignField = nested.foreignField || "_id";

          nestedPipeline.push({
            $lookup: {
              from: nestedFrom,
              localField: nestedLocalField,
              foreignField: nestedForeignField,
              as: nested.as || nestedFrom,
            },
          });
        }
      }

      pipeline.push({
        $lookup: {
          from: relatedCollection,
          let: { localId: `$${localField}` },
          pipeline: nestedPipeline,
          as: as,
        },
      });
    } else {
      pipeline.push({
        $lookup: {
          from: relatedCollection,
          localField: localField,
          foreignField: foreignField,
          as: as,
        },
      });
    }

    // Unwind to convert array to object
    pipeline.push({
      $unwind: {
        path: `$${as}`,
        preserveNullAndEmptyArrays: true,
      },
    });

    // Add limit if specified
    if ((this as any).limitValue) {
      pipeline.push({ $limit: (this as any).limitValue });
    }

    const results = await collection.aggregate(pipeline).toArray();

    return results.map((doc: any) => {
      const { _id, ...rest } = doc;
      return { id: _id, _id, ...rest };
    });
  }
);

/**
 * Execute query (alias for get())
 * Provides Mongoose-style exec() method
 */
QueryBuilder.macro("exec", async function (this: QueryBuilder<any>) {
  return await this.get();
});

/**
 * Lean query - returns plain JavaScript objects instead of model instances
 */
QueryBuilder.macro("lean", function (this: QueryBuilder<any>) {
  (this as any)._lean = true;
  return this;
});

/**
 * Direct aggregation pipeline access
 * Allows running custom MongoDB aggregation pipelines
 */
QueryBuilder.macro(
  "aggregate",
  async function (this: QueryBuilder<any>, pipeline: any[]) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const results = await collection.aggregate(pipeline).toArray();

    return results.map((doc: any) => {
      if (doc._id) {
        const { _id, ...rest } = doc;
        return { id: _id, _id, ...rest };
      }
      return doc;
    });
  }
);

// ============================================================================
// Advanced Aggregation Extensions
// ============================================================================

/**
 * $geoNear - Geospatial aggregation
 * Finds documents near a geographical point
 */
QueryBuilder.macro(
  "geoNear",
  async function (this: QueryBuilder<any>, options: GeoNearOptions) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [{ $geoNear: options }];

    // Add where clauses
    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    if ((this as any).limitValue) {
      pipeline.push({ $limit: (this as any).limitValue });
    }

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((doc: any) => {
      const { _id, ...rest } = doc;
      return { id: _id, _id, ...rest };
    });
  }
);

/**
 * Near - Simpler geo query
 * Finds documents near coordinates within a max distance
 */
QueryBuilder.macro(
  "near",
  function (
    this: QueryBuilder<any>,
    field: string,
    coordinates: [number, number],
    maxDistance?: number
  ) {
    (this as any)._geoQuery = {
      field,
      coordinates,
      maxDistance,
    };
    return this;
  }
);

/**
 * $bucket - Group documents into buckets
 */
QueryBuilder.macro(
  "bucket",
  async function (this: QueryBuilder<any>, options: BucketOptions) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    pipeline.push({
      $bucket: {
        groupBy: options.groupBy.startsWith("$")
          ? options.groupBy
          : `$${options.groupBy}`,
        boundaries: options.boundaries,
        default: options.default,
        output: options.output || { count: { $sum: 1 } },
      },
    });

    return collection.aggregate(pipeline).toArray();
  }
);

/**
 * $bucketAuto - Automatic bucketing
 */
QueryBuilder.macro(
  "bucketAuto",
  async function (this: QueryBuilder<any>, options: BucketAutoOptions) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    pipeline.push({
      $bucketAuto: {
        groupBy: options.groupBy.startsWith("$")
          ? options.groupBy
          : `$${options.groupBy}`,
        buckets: options.buckets,
        output: options.output,
        granularity: options.granularity,
      },
    });

    return collection.aggregate(pipeline).toArray();
  }
);

/**
 * $facet - Multi-faceted aggregation
 */
QueryBuilder.macro(
  "facet",
  async function (this: QueryBuilder<any>, facets: FacetOptions) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    pipeline.push({ $facet: facets });

    const results = await collection.aggregate(pipeline).toArray();
    return results[0];
  }
);

/**
 * $graphLookup - Recursive graph lookup
 */
QueryBuilder.macro(
  "graphLookup",
  async function (this: QueryBuilder<any>, options: GraphLookupOptions) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    pipeline.push({
      $graphLookup: {
        from: options.from,
        startWith: options.startWith.startsWith("$")
          ? options.startWith
          : `$${options.startWith}`,
        connectFromField: options.connectFromField,
        connectToField: options.connectToField,
        as: options.as,
        maxDepth: options.maxDepth,
        depthField: options.depthField,
        restrictSearchWithMatch: options.restrictSearchWithMatch,
      },
    });

    if ((this as any).limitValue) {
      pipeline.push({ $limit: (this as any).limitValue });
    }

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((doc: any) => {
      const { _id, ...rest } = doc;
      return { id: _id, _id, ...rest };
    });
  }
);

/**
 * Text search using MongoDB's $text operator
 */
QueryBuilder.macro(
  "textSearch",
  function (this: QueryBuilder<any>, options: TextSearchOptions) {
    (this as any)._textSearch = {
      $text: {
        $search: options.search,
        $language: options.language,
        $caseSensitive: options.caseSensitive,
        $diacriticSensitive: options.diacriticSensitive,
      },
    };
    return this;
  }
);

/**
 * Unwind array field
 */
QueryBuilder.macro(
  "unwind",
  async function (
    this: QueryBuilder<any>,
    field: string,
    options?: {
      preserveNullAndEmptyArrays?: boolean;
      includeArrayIndex?: string;
    }
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    const unwindStage: any = {
      path: field.startsWith("$") ? field : `$${field}`,
    };

    if (options?.preserveNullAndEmptyArrays !== undefined) {
      unwindStage.preserveNullAndEmptyArrays =
        options.preserveNullAndEmptyArrays;
    }

    if (options?.includeArrayIndex) {
      unwindStage.includeArrayIndex = options.includeArrayIndex;
    }

    pipeline.push({ $unwind: unwindStage });

    if ((this as any).limitValue) {
      pipeline.push({ $limit: (this as any).limitValue });
    }

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((doc: any) => {
      const { _id, ...rest } = doc;
      return { id: _id, _id, ...rest };
    });
  }
);

/**
 * Sample random documents
 */
QueryBuilder.macro(
  "sample",
  async function (this: QueryBuilder<any>, size: number) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    pipeline.push({ $sample: { size } });

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((doc: any) => {
      const { _id, ...rest } = doc;
      return { id: _id, _id, ...rest };
    });
  }
);

/**
 * Redact - Field level security
 */
QueryBuilder.macro(
  "redact",
  async function (this: QueryBuilder<any>, expression: any) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    pipeline.push({ $redact: expression });

    if ((this as any).limitValue) {
      pipeline.push({ $limit: (this as any).limitValue });
    }

    return collection.aggregate(pipeline).toArray();
  }
);

// ============================================================================
// Array Operations
// ============================================================================

/**
 * Add to set (push unique value to array)
 */
QueryBuilder.macro(
  "addToSet",
  async function (this: QueryBuilder<any>, field: string, value: any | any[]) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    const update = Array.isArray(value)
      ? { $addToSet: { [field]: { $each: value } } }
      : { $addToSet: { [field]: value } };

    return collection.updateMany(filter, update);
  }
);

/**
 * Push to array
 */
QueryBuilder.macro(
  "push",
  async function (
    this: QueryBuilder<any>,
    field: string,
    value: any | any[],
    options?: {
      position?: number;
      slice?: number;
      sort?: Record<string, 1 | -1>;
    }
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    let pushValue: any = Array.isArray(value) ? { $each: value } : value;

    if (
      options &&
      (options.position !== undefined ||
        options.slice !== undefined ||
        options.sort)
    ) {
      if (!Array.isArray(value)) {
        pushValue = { $each: [value] };
      }
      if (options.position !== undefined) {
        pushValue.$position = options.position;
      }
      if (options.slice !== undefined) {
        pushValue.$slice = options.slice;
      }
      if (options.sort) {
        pushValue.$sort = options.sort;
      }
    }

    return collection.updateMany(filter, { $push: { [field]: pushValue } });
  }
);

/**
 * Pull from array (remove matching values)
 */
QueryBuilder.macro(
  "pull",
  async function (this: QueryBuilder<any>, field: string, value: any) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    return collection.updateMany(filter, { $pull: { [field]: value } });
  }
);

/**
 * Pull all from array
 */
QueryBuilder.macro(
  "pullAll",
  async function (this: QueryBuilder<any>, field: string, values: any[]) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    return collection.updateMany(filter, { $pullAll: { [field]: values } });
  }
);

/**
 * Pop from array (-1 = first, 1 = last)
 */
QueryBuilder.macro(
  "pop",
  async function (
    this: QueryBuilder<any>,
    field: string,
    position: -1 | 1 = 1
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    return collection.updateMany(filter, { $pop: { [field]: position } });
  }
);

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Upsert - Insert or update
 */
QueryBuilder.macro(
  "upsertDoc",
  async function (this: QueryBuilder<any>, data: Record<string, any>) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    return collection.updateOne(filter, { $set: data }, { upsert: true });
  }
);

/**
 * Find one and update
 */
QueryBuilder.macro(
  "findOneAndUpdate",
  async function (
    this: QueryBuilder<any>,
    update: Record<string, any>,
    options?: { returnDocument?: "before" | "after"; upsert?: boolean }
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    const result = await collection.findOneAndUpdate(
      filter,
      { $set: update },
      {
        returnDocument: options?.returnDocument || "after",
        upsert: options?.upsert,
      }
    );

    if (result) {
      const { _id, ...rest } = result;
      return { id: _id, _id, ...rest };
    }
    return null;
  }
);

/**
 * Find one and delete
 */
QueryBuilder.macro(
  "findOneAndDelete",
  async function (this: QueryBuilder<any>) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    const result = await collection.findOneAndDelete(filter);

    if (result) {
      const { _id, ...rest } = result;
      return { id: _id, _id, ...rest };
    }
    return null;
  }
);

/**
 * Replace one document
 */
QueryBuilder.macro(
  "replaceOne",
  async function (this: QueryBuilder<any>, replacement: Record<string, any>) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    return collection.replaceOne(filter, replacement);
  }
);

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk write operations
 */
QueryBuilder.macro(
  "bulkWrite",
  async function (
    this: QueryBuilder<any>,
    operations: Array<{
      insertOne?: { document: Record<string, any> };
      updateOne?: {
        filter: Record<string, any>;
        update: Record<string, any>;
        upsert?: boolean;
      };
      updateMany?: {
        filter: Record<string, any>;
        update: Record<string, any>;
        upsert?: boolean;
      };
      deleteOne?: { filter: Record<string, any> };
      deleteMany?: { filter: Record<string, any> };
      replaceOne?: {
        filter: Record<string, any>;
        replacement: Record<string, any>;
        upsert?: boolean;
      };
    }>,
    options?: { ordered?: boolean }
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    return collection.bulkWrite(operations, options);
  }
);

// ============================================================================
// Index Operations
// ============================================================================

/**
 * Create index
 */
QueryBuilder.macro(
  "createIndex",
  async function (
    this: QueryBuilder<any>,
    keys: Record<string, 1 | -1 | "2dsphere" | "text" | "hashed">,
    options?: {
      unique?: boolean;
      sparse?: boolean;
      expireAfterSeconds?: number;
      name?: string;
      partialFilterExpression?: Record<string, any>;
      background?: boolean;
    }
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    return collection.createIndex(keys, options);
  }
);

/**
 * Drop index
 */
QueryBuilder.macro(
  "dropIndex",
  async function (this: QueryBuilder<any>, indexName: string) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    return collection.dropIndex(indexName);
  }
);

/**
 * List indexes
 */
QueryBuilder.macro("listIndexes", async function (this: QueryBuilder<any>) {
  const db = await this.adapter.raw("db");
  const collection = db.collection(this.tableName);

  return collection.listIndexes().toArray();
});

// ============================================================================
// Change Streams (Real-time)
// ============================================================================

/**
 * Watch collection for changes
 */
QueryBuilder.macro(
  "watch",
  async function (
    this: QueryBuilder<any>,
    callback: (change: any) => void | Promise<void>,
    options?: ChangeStreamOptions
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const pipeline: any[] = [];

    if ((this as any).whereClauses && (this as any).whereClauses.length > 0) {
      const filter =
        this.adapter.buildFilter?.((this as any).whereClauses) || {};
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }
    }

    const changeStream = collection.watch(pipeline, options);

    changeStream.on("change", async (change: any) => {
      await callback(change);
    });

    return changeStream;
  }
);

// ============================================================================
// Stats and Explain
// ============================================================================

/**
 * Get collection stats
 */
QueryBuilder.macro("stats", async function (this: QueryBuilder<any>) {
  const db = await this.adapter.raw("db");
  return db.command({ collStats: this.tableName });
});

/**
 * Explain query execution
 */
QueryBuilder.macro(
  "explain",
  async function (
    this: QueryBuilder<any>,
    verbosity:
      | "queryPlanner"
      | "executionStats"
      | "allPlansExecution" = "executionStats"
  ) {
    const db = await this.adapter.raw("db");
    const collection = db.collection(this.tableName);

    const filter = this.adapter.buildFilter?.((this as any).whereClauses) || {};

    return collection.find(filter).explain(verbosity);
  }
);

/**
 * Validate collection
 */
QueryBuilder.macro(
  "validate",
  async function (
    this: QueryBuilder<any>,
    options?: { full?: boolean; repair?: boolean }
  ) {
    const db = await this.adapter.raw("db");
    return db.command({
      validate: this.tableName,
      ...options,
    });
  }
);

// ============================================================================
// TypeScript type augmentation for better IDE support
// ============================================================================

declare module "../QueryBuilder" {
  interface QueryBuilder<T> {
    // Core Mongoose-style
    populate(field: string, options?: PopulateOptions): Promise<T[]>;
    exec(): Promise<T[]>;
    lean(): QueryBuilder<T>;
    aggregate(pipeline: any[]): Promise<any[]>;

    // Geospatial
    geoNear(options: GeoNearOptions): Promise<T[]>;
    near(
      field: string,
      coordinates: [number, number],
      maxDistance?: number
    ): QueryBuilder<T>;

    // Advanced Aggregation
    bucket(options: BucketOptions): Promise<any[]>;
    bucketAuto(options: BucketAutoOptions): Promise<any[]>;
    facet(facets: FacetOptions): Promise<Record<string, any[]>>;
    graphLookup(options: GraphLookupOptions): Promise<T[]>;
    textSearch(options: TextSearchOptions): QueryBuilder<T>;
    unwind(
      field: string,
      options?: {
        preserveNullAndEmptyArrays?: boolean;
        includeArrayIndex?: string;
      }
    ): Promise<T[]>;
    sample(size: number): Promise<T[]>;
    redact(expression: any): Promise<any[]>;

    // Array Operations
    addToSet(field: string, value: any | any[]): Promise<any>;
    push(
      field: string,
      value: any | any[],
      options?: {
        position?: number;
        slice?: number;
        sort?: Record<string, 1 | -1>;
      }
    ): Promise<any>;
    pull(field: string, value: any): Promise<any>;
    pullAll(field: string, values: any[]): Promise<any>;
    pop(field: string, position?: -1 | 1): Promise<any>;

    // Document Operations
    upsertDoc(data: Record<string, any>): Promise<any>;
    findOneAndUpdate(
      update: Record<string, any>,
      options?: { returnDocument?: "before" | "after"; upsert?: boolean }
    ): Promise<T | null>;
    findOneAndDelete(): Promise<T | null>;
    replaceOne(replacement: Record<string, any>): Promise<any>;

    // Bulk Operations
    bulkWrite(
      operations: Array<any>,
      options?: { ordered?: boolean }
    ): Promise<any>;

    // Index Operations
    createIndex(
      keys: Record<string, 1 | -1 | "2dsphere" | "text" | "hashed">,
      options?: any
    ): Promise<string>;
    dropIndex(indexName: string): Promise<void>;
    listIndexes(): Promise<any[]>;

    // Change Streams
    watch(
      callback: (change: any) => void | Promise<void>,
      options?: ChangeStreamOptions
    ): Promise<any>;

    // Stats and Explain
    stats(): Promise<any>;
    explain(
      verbosity?: "queryPlanner" | "executionStats" | "allPlansExecution"
    ): Promise<any>;
    validate(options?: { full?: boolean; repair?: boolean }): Promise<any>;
  }
}
