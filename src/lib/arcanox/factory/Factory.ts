import type { Faker } from "@faker-js/faker";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import { Model } from "../Model";

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export type RelationFactory<M extends Model> = new () => Factory<M>;

export type RelationConfig<M extends Model = Model> = {
  factory: RelationFactory<M>;
  /** Number of entities to create per related record */
  numberOfEntities?: number;
  /** Attributes to override */
  attributes?: Partial<M>;
};

export type RelationDefinitions = Record<string, RelationConfig<Model>>;

export type RelationContext = Record<string, Model>;

/**
 * Factory state definition
 */
export type StateDefinition<T> = () => Partial<T>;

/**
 * Factory callback type
 */
export type FactoryCallback<T extends Model> = (
  model: T,
  faker: Faker
) => void | Promise<void>;

/**
 * Sequence callback type
 */
export type SequenceCallback<T> = (sequence: number) => T;

/**
 * Factory configuration options
 */
export interface FactoryOptions {
  /**
   * Whether to persist models immediately
   */
  persist?: boolean;

  /**
   * Database connection to use
   */
  connection?: string;
}

// =============================================================================
// BASE FACTORY CLASS
// =============================================================================

/**
 * Base Factory class - Professional model factory for testing and seeding
 *
 * @example
 * ```typescript
 * class UserFactory extends Factory<User> {
 *   protected model = User;
 *
 *   definition() {
 *     return {
 *       name: this.faker.person.fullName(),
 *       email: this.faker.internet.email(),
 *     };
 *   }
 *
 *   // Define states
 *   admin() {
 *     return this.state(() => ({ role: 'admin' }));
 *   }
 *
 *   unverified() {
 *     return this.state(() => ({ email_verified_at: null }));
 *   }
 * }
 *
 * // Usage
 * const user = await UserFactory.new().create();
 * const admin = await UserFactory.new().admin().create();
 * const users = await UserFactory.new().count(10).create();
 * ```
 */
export abstract class Factory<T extends Model> {
  protected abstract model: new () => T;
  protected relations: RelationDefinitions = {};
  protected faker: Faker;
  private relationContext: RelationContext = {};
  private stateDefinitions: Map<string, StateDefinition<T>> = new Map();
  private pendingStates: StateDefinition<T>[] = [];
  private afterCreatingCallbacks: FactoryCallback<T>[] = [];
  private afterMakingCallbacks: FactoryCallback<T>[] = [];
  private _count: number = 1;
  private _attributes: Partial<T> = {};
  private _sequences: Map<string, number> = new Map();
  private _connection?: string;
  private _recycle: Model[] = [];

  constructor() {
    this.faker = ModuleLoader.require("@faker-js/faker").faker;
    this.configure();
  }

  /**
   * Configure the factory (override to add states and callbacks)
   */
  protected configure(): void {
    // Override in subclass
  }

  /**
   * Define the model's default state.
   */
  abstract definition(): Record<string, any>;

  // ===========================================================================
  // STATIC FACTORY METHODS
  // ===========================================================================

  /**
   * Create a new factory instance
   */
  static new<F extends Factory<any>>(this: new () => F): F {
    return new this();
  }

  /**
   * Create a single model (shorthand)
   */
  static async createOne<F extends Factory<any>>(
    this: new () => F,
    attributes?: Partial<F extends Factory<infer M> ? M : never>
  ): Promise<F extends Factory<infer M> ? M : never> {
    const factory = new this();
    return factory.create(attributes as any) as any;
  }

  /**
   * Create multiple models (shorthand)
   */
  static async createMany<F extends Factory<any>>(
    this: new () => F,
    count: number,
    attributes?: Partial<F extends Factory<infer M> ? M : never>
  ): Promise<Array<F extends Factory<infer M> ? M : never>> {
    const factory = new this();
    return factory.count(count).create(attributes as any) as any;
  }

  // ===========================================================================
  // FLUENT BUILDER METHODS
  // ===========================================================================

  /**
   * Set the number of models to create
   */
  count(count: number): this {
    this._count = count;
    return this;
  }

  /**
   * Set times (alias for count)
   */
  times(count: number): this {
    return this.count(count);
  }

  /**
   * Set connection to use
   */
  connection(connection: string): this {
    this._connection = connection;
    return this;
  }

  /**
   * Recycle existing models for relations
   */
  recycle(...models: Model[]): this {
    this._recycle.push(...models);
    return this;
  }

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Define a state
   */
  protected defineState(name: string, definition: StateDefinition<T>): void {
    this.stateDefinitions.set(name, definition);
  }

  /**
   * Apply a state transformation
   */
  state(state: StateDefinition<T> | string): this {
    if (typeof state === "string") {
      const stateDefinition = this.stateDefinitions.get(state);
      if (stateDefinition) {
        this.pendingStates.push(stateDefinition);
      }
    } else {
      this.pendingStates.push(state);
    }
    return this;
  }

  /**
   * Apply multiple states
   */
  applyStates(...stateNames: string[]): this {
    for (const name of stateNames) {
      this.state(name);
    }
    return this;
  }

  // ===========================================================================
  // SEQUENCE SUPPORT
  // ===========================================================================

  /**
   * Get next sequence value
   */
  protected sequence(name: string = "default"): number {
    const current = this._sequences.get(name) || 0;
    this._sequences.set(name, current + 1);
    return current + 1;
  }

  /**
   * Create sequential values
   */
  protected sequential<V>(name: string, callback: SequenceCallback<V>): V {
    return callback(this.sequence(name));
  }

  // ===========================================================================
  // RELATION CONTEXT
  // ===========================================================================

  /**
   * Access a related model provided by the current seeding context.
   */
  protected related<M extends Model = Model>(name: string): M {
    // Check recycled models first
    for (const model of this._recycle) {
      if (
        model.constructor.name.toLowerCase() === name.toLowerCase() ||
        (model as any).table === name
      ) {
        return model as M;
      }
    }

    const relation = this.relationContext[name];
    if (!relation) {
      throw new Error(
        `No related entity found for relation "${name}". ` +
          `Ensure you are calling run() or passing relation context.`
      );
    }

    return relation as M;
  }

  /**
   * Check if a relation exists in context
   */
  protected hasRelation(name: string): boolean {
    return (
      name in this.relationContext ||
      this._recycle.some(
        (m) =>
          m.constructor.name.toLowerCase() === name.toLowerCase() ||
          (m as any).table === name
      )
    );
  }

  /**
   * Get related or null
   */
  protected relatedOrNull<M extends Model = Model>(name: string): M | null {
    try {
      return this.related<M>(name);
    } catch {
      return null;
    }
  }

  private withRelationContext<R>(
    context: RelationContext,
    callback: () => R
  ): R {
    const previousContext = this.relationContext;
    this.relationContext = context;

    try {
      return callback();
    } finally {
      this.relationContext = previousContext;
    }
  }

  // ===========================================================================
  // CALLBACKS
  // ===========================================================================

  /**
   * Add callback to run after creating
   */
  afterCreating(callback: FactoryCallback<T>): this {
    this.afterCreatingCallbacks.push(callback);
    return this;
  }

  /**
   * Add callback to run after making (before persisting)
   */
  afterMaking(callback: FactoryCallback<T>): this {
    this.afterMakingCallbacks.push(callback);
    return this;
  }

  // ===========================================================================
  // CORE FACTORY METHODS
  // ===========================================================================

  /**
   * Build the raw attributes for a model
   */
  raw(attributes: Partial<T> = {}): Record<string, any> {
    // Get base definition
    let data = this.definition();

    // Apply pending states
    for (const stateDefinition of this.pendingStates) {
      data = { ...data, ...stateDefinition() };
    }

    // Apply instance attributes
    data = { ...data, ...this._attributes, ...attributes };

    return data;
  }

  /**
   * Create a new model instance with attributes (not persisted).
   */
  make(
    attributes: Partial<T> = {},
    relationContext: RelationContext = {}
  ): T | T[] {
    const results: T[] = [];

    for (let i = 0; i < this._count; i++) {
      const instance = this.withRelationContext(relationContext, () => {
        const model = new this.model();
        const data = this.raw(attributes);
        model.fill(data);
        return model;
      });

      // Run after making callbacks
      for (const callback of this.afterMakingCallbacks) {
        callback(instance, this.faker);
      }

      results.push(instance);
    }

    // Reset count for next operation
    const count = this._count;
    this._count = 1;
    this.pendingStates = [];

    return count === 1 ? results[0] : results;
  }

  /**
   * Create and save a new model instance.
   */
  async create(
    attributes: Partial<T> = {},
    relationContext: RelationContext = {}
  ): Promise<T | T[]> {
    const results: T[] = [];

    for (let i = 0; i < this._count; i++) {
      const instance = this.withRelationContext(relationContext, () => {
        const model = new this.model();
        const data = this.raw(attributes);
        model.fill(data);
        return model;
      });

      // Run after making callbacks
      for (const callback of this.afterMakingCallbacks) {
        await callback(instance, this.faker);
      }

      await instance.save();

      // Run after creating callbacks
      for (const callback of this.afterCreatingCallbacks) {
        await callback(instance, this.faker);
      }

      results.push(instance);
    }

    // Reset for next operation
    const count = this._count;
    this._count = 1;
    this.pendingStates = [];

    return count === 1 ? results[0] : results;
  }

  /**
   * Create multiple instances (explicit method)
   */
  async createMany(
    count: number,
    attributes: Partial<T> = {},
    relationContext: RelationContext = {}
  ): Promise<T[]> {
    this._count = count;
    const result = await this.create(attributes, relationContext);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Make multiple instances without persisting
   */
  makeMany(
    count: number,
    attributes: Partial<T> = {},
    relationContext: RelationContext = {}
  ): T[] {
    this._count = count;
    const result = this.make(attributes, relationContext);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Create or get from recycled models
   */
  async createOrRecycle(attributes: Partial<T> = {}): Promise<T> {
    const recycled = this._recycle.find((m) => m instanceof this.model) as
      | T
      | undefined;

    if (recycled) {
      return recycled;
    }

    const result = await this.create(attributes);
    return Array.isArray(result) ? result[0] : result;
  }

  // ===========================================================================
  // RELATION-BASED SEEDING
  // ===========================================================================

  /**
   * Run the factory against configured relations.
   * For each related record found, create the configured number of entities.
   */
  async run(): Promise<void> {
    const relationEntries = Object.entries(this.relations);

    if (!relationEntries.length) {
      throw new Error(
        "No relations configured for this factory. " +
          "Use create or createMany directly instead."
      );
    }

    for (const [relationName, config] of relationEntries) {
      const {
        factory: RelationFactory,
        numberOfEntities = 1,
        attributes = {},
      } = config;
      const relationFactory = new RelationFactory();
      const RelatedModel = relationFactory.model as typeof Model;

      if (!RelatedModel?.all) {
        console.warn(
          `Relation "${relationName}" does not expose a static all() method. Skipping.`
        );
        continue;
      }

      const relatedEntities = ((await (RelatedModel as any).all()) ||
        []) as Model[];

      if (!relatedEntities.length) {
        console.warn(
          `No related entities found for "${relationName}". ` +
            `Nothing to seed for this relation.`
        );
        continue;
      }

      for (const relatedEntity of relatedEntities) {
        const context: RelationContext = { [relationName]: relatedEntity };

        for (let i = 0; i < numberOfEntities; i++) {
          await this.create(attributes as Partial<T>, context);
        }
      }
    }
  }

  // ===========================================================================
  // HAS RELATIONS (Create with related models)
  // ===========================================================================

  /**
   * Create model with related models
   */
  has<R extends Model>(
    relation: string,
    factoryOrCount: Factory<R> | number,
    countOrCallback?: number | ((factory: Factory<R>) => Factory<R>)
  ): this {
    // Store has relation config for later processing
    (this as any)._hasRelations = (this as any)._hasRelations || [];
    (this as any)._hasRelations.push({
      relation,
      factory: typeof factoryOrCount === "number" ? null : factoryOrCount,
      count:
        typeof factoryOrCount === "number" ? factoryOrCount : countOrCallback,
      callback: typeof countOrCallback === "function" ? countOrCallback : null,
    });
    return this;
  }

  /**
   * Create model for a belongs-to relationship
   */
  for<R extends Model>(model: R | Factory<R>, relation?: string): this {
    if (model instanceof Model) {
      this._recycle.push(model);
    } else {
      (this as any)._forRelations = (this as any)._forRelations || [];
      (this as any)._forRelations.push({ factory: model, relation });
    }
    return this;
  }
}

// =============================================================================
// FACTORY MANAGER
// =============================================================================

/**
 * Factory Manager - Registry and utility for managing factories
 */
export class FactoryManager {
  private static factories: Map<string, new () => Factory<any>> = new Map();
  private static instances: Map<string, Factory<any>> = new Map();

  /**
   * Register a factory
   */
  static register<T extends Model>(
    name: string,
    factory: new () => Factory<T>
  ): void {
    this.factories.set(name, factory);
  }

  /**
   * Get or create a factory instance
   */
  static get<T extends Model>(name: string): Factory<T> {
    let instance = this.instances.get(name);

    if (!instance) {
      const FactoryClass = this.factories.get(name);
      if (!FactoryClass) {
        throw new Error(`Factory "${name}" not found. Did you register it?`);
      }
      instance = new FactoryClass();
      this.instances.set(name, instance);
    }

    return instance as Factory<T>;
  }

  /**
   * Create a new factory instance (not cached)
   */
  static make<T extends Model>(name: string): Factory<T> {
    const FactoryClass = this.factories.get(name);
    if (!FactoryClass) {
      throw new Error(`Factory "${name}" not found. Did you register it?`);
    }
    return new FactoryClass() as Factory<T>;
  }

  /**
   * Check if factory is registered
   */
  static has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Clear all cached instances
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Clear all registrations
   */
  static clear(): void {
    this.factories.clear();
    this.instances.clear();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a factory helper function
 */
export function factory<T extends Model>(
  FactoryClass: new () => Factory<T>
): Factory<T> {
  return new FactoryClass();
}

/**
 * Define a factory inline
 */
export function defineFactory<T extends Model>(
  ModelClass: new () => T,
  definition: (faker: Faker) => Record<string, any>
): new () => Factory<T> {
  return class extends Factory<T> {
    protected model = ModelClass;

    definition(): Record<string, any> {
      return definition(this.faker);
    }
  };
}
