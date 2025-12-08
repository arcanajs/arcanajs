import "reflect-metadata";

export type ClassConstructor<T = any> = new (...args: any[]) => T;
export type FactoryFunction<T = any> = (container: Container) => T;

export class Container {
  private static instance: Container;
  private bindings: Map<string | ClassConstructor, FactoryFunction> = new Map();
  private singletons: Map<string | ClassConstructor, any> = new Map();

  constructor() {
    if (!Container.instance) {
      Container.instance = this;
    }
  }

  /**
   * Get the global container instance
   */
  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Bind a class or factory to the container
   */
  public bind<T>(
    key: string | ClassConstructor<T>,
    value: ClassConstructor<T> | FactoryFunction<T>
  ): void {
    if (this.isConstructor(value)) {
      this.bindings.set(key, () => this.build(value));
    } else {
      this.bindings.set(key, value as FactoryFunction<T>);
    }
  }

  /**
   * Bind a singleton to the container
   */
  public singleton<T>(
    key: string | ClassConstructor<T>,
    value: ClassConstructor<T> | FactoryFunction<T>
  ): void {
    const factory = this.isConstructor(value)
      ? () => this.build(value)
      : (value as FactoryFunction<T>);

    this.bindings.set(key, () => {
      if (!this.singletons.has(key)) {
        this.singletons.set(key, factory(this));
      }
      return this.singletons.get(key);
    });
  }

  /**
   * Resolve a dependency from the container
   */
  public make<T>(key: string | ClassConstructor<T>): T {
    if (this.bindings.has(key)) {
      return this.bindings.get(key)!(this);
    }

    // If it's a class and not bound, try to build it directly
    if (this.isConstructor(key)) {
      return this.build(key);
    }

    throw new Error(`Service not found: ${key.toString()}`);
  }

  /**
   * Check if a service is registered in the container
   */
  public has(key: string | ClassConstructor): boolean {
    return this.bindings.has(key);
  }

  /**
   * Alias for make() - resolve a dependency from the container
   */
  public resolve<T>(key: string | ClassConstructor<T>): T {
    return this.make(key);
  }

  /**
   * Instantiate a class, resolving its dependencies
   */
  private build<T>(target: ClassConstructor<T>): T {
    // Get constructor parameters using reflect-metadata
    const params = Reflect.getMetadata("design:paramtypes", target) || [];

    const injections = params.map((param: any) => {
      return this.make(param);
    });

    return new target(...injections);
  }

  private isConstructor(obj: any): obj is ClassConstructor {
    return !!obj.prototype && !!obj.prototype.constructor.name;
  }
}

export const container = Container.getInstance();
