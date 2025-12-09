import type { Faker } from "@faker-js/faker";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import { Model } from "../Model";

type RelationFactory<M extends Model> = new () => Factory<M>;

type RelationConfig<M extends Model = Model> = {
  factory: RelationFactory<M>;
  /** Number of entities to create per related record */
  numberOfEntities?: number;
};

type RelationDefinitions = Record<string, RelationConfig<Model>>;

type RelationContext = Record<string, Model>;

/**
 * Base Factory class
 */
export abstract class Factory<T extends Model> {
  protected abstract model: new () => T;
  protected relations: RelationDefinitions = {};
  protected faker: Faker;
  private relationContext: RelationContext = {};

  constructor() {
    // We'll load faker dynamically to avoid bundling it if not used
    // But for type safety we declare it here
    this.faker = ModuleLoader.require("@faker-js/faker").faker;
  }

  /**
   * Define the model's default state.
   */
  abstract definition(): Record<string, any>;

  /**
   * Access a related model provided by the current seeding context.
   */
  protected related<M extends Model = Model>(name: string): M {
    const relation = this.relationContext[name];
    if (!relation) {
      throw new Error(
        `No related entity found for relation "${name}". Ensure you are calling run() or passing relation context.`
      );
    }

    return relation as M;
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

  /**
   * Create a new model instance with attributes.
   */
  make(attributes: Partial<T> = {}, relationContext: RelationContext = {}): T {
    return this.withRelationContext(relationContext, () => {
      const instance = new this.model();
      const defaults = this.definition();

      // Merge defaults with overrides
      const data = { ...defaults, ...attributes };

      // Fill model
      instance.fill(data);

      return instance;
    });
  }

  /**
   * Create and save a new model instance.
   */
  async create(
    attributes: Partial<T> = {},
    relationContext: RelationContext = {}
  ): Promise<T> {
    const instance = this.make(attributes, relationContext);
    await instance.save();
    return instance;
  }

  /**
   * Create multiple instances
   */
  async createMany(
    count: number,
    attributes: Partial<T> = {},
    relationContext: RelationContext = {}
  ): Promise<T[]> {
    const instances: T[] = [];
    for (let i = 0; i < count; i++) {
      instances.push(await this.create(attributes, relationContext));
    }
    return instances;
  }

  /**
   * Run the factory against configured relations.
   * For each related record found, create the configured number of entities.
   */
  async run(): Promise<void> {
    const relationEntries = Object.entries(this.relations);

    if (!relationEntries.length) {
      throw new Error(
        "No relations configured for this factory. Use create or createMany directly instead."
      );
    }

    for (const [relationName, config] of relationEntries) {
      const { factory: RelationFactory, numberOfEntities = 1 } = config;
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
          `No related entities found for "${relationName}". Nothing to seed for this relation.`
        );
        continue;
      }

      for (const relatedEntity of relatedEntities) {
        const context: RelationContext = { [relationName]: relatedEntity };

        for (let i = 0; i < numberOfEntities; i++) {
          await this.create({}, context);
        }
      }
    }
  }
}
