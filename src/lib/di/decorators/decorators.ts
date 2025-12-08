import { ClassConstructor } from "../Container";
import { setInjectableMetadata } from "./metadata";
import { InjectableOptions } from "./types";

/**
 * Mark a class as injectable for automatic dependency injection
 *
 * @example
 * ```typescript
 * @Injectable()
 * class UserService {
 *   constructor(private userRepository: UserRepository) {}
 * }
 * ```
 *
 * @example With singleton scope
 * ```typescript
 * @Injectable({ scope: 'singleton' })
 * class DatabaseConnection {
 *   // This will be instantiated only once
 * }
 * ```
 */
export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return function (target: any) {
    const scope = options.scope || "transient";

    setInjectableMetadata(target as ClassConstructor, {
      target: target as ClassConstructor,
      scope,
      key: options.key,
    });

    return target;
  };
}

/**
 * Mark a class as a service (alias for @Injectable)
 * Services are typically transient by default
 *
 * @example
 * ```typescript
 * @Service()
 * class UserService {
 *   constructor(private userRepository: UserRepository) {}
 * }
 * ```
 */
export function Service(options: InjectableOptions = {}): ClassDecorator {
  return Injectable(options);
}

/**
 * Mark a class as a repository (alias for @Injectable with singleton scope)
 * Repositories are typically singletons to maintain connection pooling
 *
 * @example
 * ```typescript
 * @Repository()
 * class UserRepository {
 *   async findById(id: number) {
 *     // Database logic
 *   }
 * }
 * ```
 */
export function Repository(options: InjectableOptions = {}): ClassDecorator {
  return Injectable({
    scope: "singleton",
    ...options,
  });
}

/**
 * Mark a class as a controller (alias for @Injectable)
 * Controllers are typically transient
 *
 * @example
 * ```typescript
 * @Controller()
 * class UserController {
 *   constructor(private userService: UserService) {}
 * }
 * ```
 */
export function Controller(options: InjectableOptions = {}): ClassDecorator {
  return Injectable(options);
}
