import express, {
  Router as ExpressRouter,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import ControllerBinder from "./ControllerBinder";
import MiddlewareBinder from "./MiddlewareBinder";

/**
 * Route definition for internal storage
 */
interface RouteDefinition {
  method: string;
  path: string;
  name?: string;
  constraints: Record<string, RegExp>;
  middlewares: RequestHandler[];
  action: any;
}

/**
 * Named routes registry for reverse routing
 */
class RouteRegistry {
  private static routes: Map<string, RouteDefinition> = new Map();

  static register(name: string, route: RouteDefinition): void {
    this.routes.set(name, route);
  }

  static get(name: string): RouteDefinition | undefined {
    return this.routes.get(name);
  }

  static has(name: string): boolean {
    return this.routes.has(name);
  }

  static all(): Map<string, RouteDefinition> {
    return this.routes;
  }

  static clear(): void {
    this.routes.clear();
  }
}

/**
 * Route builder for chaining route configuration
 */
export class RouteBuilder {
  private routeName?: string;
  private routeConstraints: Record<string, RegExp> = {};
  private registerFn: (
    name?: string,
    constraints?: Record<string, RegExp>
  ) => void;

  constructor(
    registerFn: (name?: string, constraints?: Record<string, RegExp>) => void
  ) {
    this.registerFn = registerFn;
    // Auto-register without name if not chained
    setTimeout(() => {
      if (!this.routeName) {
        this.registerFn(undefined, this.routeConstraints);
      }
    }, 0);
  }

  /**
   * Assign a name to the route for reverse routing
   *
   * @example
   * Route.get('/users/:id', handler).name('user.show');
   * // Later: Route.urlFor('user.show', { id: 1 }) => '/users/1'
   */
  name(routeName: string): this {
    this.routeName = routeName;
    this.registerFn(routeName, this.routeConstraints);
    return this;
  }

  /**
   * Add parameter constraints to the route
   *
   * @example
   * Route.get('/users/:id', handler).where('id', /^\d+$/);
   */
  where(param: string, pattern: RegExp | string): this {
    this.routeConstraints[param] =
      typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return this;
  }

  /**
   * Add multiple constraints at once
   *
   * @example
   * Route.get('/posts/:year/:month', handler).whereAll({
   *   year: /^\d{4}$/,
   *   month: /^\d{2}$/
   * });
   */
  whereAll(constraints: Record<string, RegExp | string>): this {
    for (const [param, pattern] of Object.entries(constraints)) {
      this.where(param, pattern);
    }
    return this;
  }

  /**
   * Constraint: parameter must be numeric
   */
  whereNumber(param: string): this {
    return this.where(param, /^\d+$/);
  }

  /**
   * Constraint: parameter must be alphabetic
   */
  whereAlpha(param: string): this {
    return this.where(param, /^[a-zA-Z]+$/);
  }

  /**
   * Constraint: parameter must be alphanumeric
   */
  whereAlphaNumeric(param: string): this {
    return this.where(param, /^[a-zA-Z0-9]+$/);
  }

  /**
   * Constraint: parameter must be a UUID
   */
  whereUuid(param: string): this {
    return this.where(
      param,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  }

  /**
   * Constraint: parameter must be a slug
   */
  whereSlug(param: string): this {
    return this.where(param, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
}

/**
 * Provides Routing syntax for defining routes with prefixes, middlewares, and groups for ArcanaJS Framework
 */
export class ArcanaJSRouter {
  private router: ExpressRouter;
  private middlewareStack: RequestHandler[];
  private prefixStack: string[];
  private isApiMode: boolean = false;
  private registeredRoutes: RouteDefinition[] = [];

  constructor() {
    this.router = express.Router();
    this.middlewareStack = [];
    this.prefixStack = [];
  }

  /**
   * Add middleware to the current stack
   */
  middleware(...middleware: any[]): ArcanaJSRouter {
    const newRouter = this._clone();
    const resolvedMiddlewares = middleware.map((m) =>
      this._resolveMiddleware(m)
    );
    newRouter.middlewareStack = [
      ...this.middlewareStack,
      ...resolvedMiddlewares,
    ];
    return newRouter;
  }

  /**
   * Add prefix to the current stack
   */
  prefix(prefix: string): ArcanaJSRouter {
    const newRouter = this._clone();
    newRouter.prefixStack = [
      ...this.prefixStack,
      prefix.replace(/^\/|\/$/g, ""),
    ];
    return newRouter;
  }

  /**
   * Mark routes as API-only (JSON responses, no HTML)
   */
  api(): ArcanaJSRouter {
    const newRouter = this._clone();
    newRouter.isApiMode = true;
    return newRouter;
  }

  /**
   * Create a route group
   */
  group(callback: (router: ArcanaJSRouter) => void): ArcanaJSRouter {
    callback(this);
    return this;
  }

  /**
   * Define a GET route
   */
  get(path: string, ...args: any[]): RouteBuilder {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("get", path, action, middlewares);
  }

  /**
   * Define a POST route
   */
  post(path: string, ...args: any[]): RouteBuilder {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("post", path, action, middlewares);
  }

  /**
   * Define a PUT route
   */
  put(path: string, ...args: any[]): RouteBuilder {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("put", path, action, middlewares);
  }

  /**
   * Define a DELETE route
   */
  delete(path: string, ...args: any[]): RouteBuilder {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("delete", path, action, middlewares);
  }

  /**
   * Define a PATCH route
   */
  patch(path: string, ...args: any[]): RouteBuilder {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("patch", path, action, middlewares);
  }

  /**
   * Define an OPTIONS route
   */
  options(path: string, ...args: any[]): RouteBuilder {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("options", path, action, middlewares);
  }

  /**
   * Define a resource route
   * Registers index, create, store, show, edit, update, destroy routes
   */
  resource(
    path: string,
    controller: any,
    options?: { only?: string[]; except?: string[] }
  ): ArcanaJSRouter {
    const resourceName = path.replace(/^\//, "").replace(/\//g, ".");
    const actions = [
      "index",
      "create",
      "store",
      "show",
      "edit",
      "update",
      "destroy",
    ];

    const shouldInclude = (action: string) => {
      if (options?.only) return options.only.includes(action);
      if (options?.except) return !options.except.includes(action);
      return true;
    };

    if (shouldInclude("index"))
      this.get(path, controller, "index").name(`${resourceName}.index`);
    if (shouldInclude("create"))
      this.get(`${path}/create`, controller, "create").name(
        `${resourceName}.create`
      );
    if (shouldInclude("store"))
      this.post(path, controller, "store").name(`${resourceName}.store`);
    if (shouldInclude("show"))
      this.get(`${path}/:id`, controller, "show").name(`${resourceName}.show`);
    if (shouldInclude("edit"))
      this.get(`${path}/:id/edit`, controller, "edit").name(
        `${resourceName}.edit`
      );
    if (shouldInclude("update")) {
      this.put(`${path}/:id`, controller, "update").name(
        `${resourceName}.update`
      );
      this.patch(`${path}/:id`, controller, "update");
    }
    if (shouldInclude("destroy"))
      this.delete(`${path}/:id`, controller, "destroy").name(
        `${resourceName}.destroy`
      );

    return this;
  }

  /**
   * Get the underlying Express router
   */
  getRouter(): ExpressRouter {
    return this.router;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): RouteDefinition[] {
    return this.registeredRoutes;
  }

  /**
   * Clone the current router instance
   */
  private _clone(): ArcanaJSRouter {
    const newRouter = new ArcanaJSRouter();
    newRouter.router = this.router;
    newRouter.middlewareStack = [...this.middlewareStack];
    newRouter.prefixStack = [...this.prefixStack];
    newRouter.isApiMode = this.isApiMode;
    newRouter.registeredRoutes = this.registeredRoutes;
    return newRouter;
  }

  /**
   * Add a route to the router
   */
  private _addRoute(
    method: "get" | "post" | "put" | "delete" | "patch" | "options",
    path: string,
    action: any,
    routeMiddlewares: any[] = []
  ): RouteBuilder {
    const fullPath = this._buildPath(path);
    const handler = this._buildHandler(action);
    const flatMiddlewares = routeMiddlewares.flat(Infinity);
    const resolvedMiddlewares = flatMiddlewares.map((m) =>
      this._resolveMiddleware(m)
    );

    // API mode middleware
    const apiMiddleware: RequestHandler[] = this.isApiMode
      ? [
          (_req: Request, res: Response, next: NextFunction) => {
            res.setHeader("Content-Type", "application/json");
            next();
          },
        ]
      : [];

    const middlewares = [
      ...apiMiddleware,
      ...this.middlewareStack,
      ...resolvedMiddlewares,
    ];

    // Create route definition
    const routeDef: RouteDefinition = {
      method: method.toUpperCase(),
      path: fullPath,
      constraints: {},
      middlewares,
      action,
    };

    // Create builder that will register the route
    let registered = false;
    const builder = new RouteBuilder((name, constraints) => {
      if (registered) return;
      registered = true;

      routeDef.name = name;
      routeDef.constraints = constraints || {};

      // Add constraint validation middleware if there are constraints
      const constraintMiddleware: RequestHandler[] =
        Object.keys(routeDef.constraints).length > 0
          ? [this._createConstraintMiddleware(routeDef.constraints)]
          : [];

      // Register with Express
      this.router[method](
        fullPath,
        ...constraintMiddleware,
        ...middlewares,
        handler
      );

      // Store route definition
      this.registeredRoutes.push(routeDef);

      // Register named route
      if (name) {
        RouteRegistry.register(name, routeDef);
      }
    });

    return builder;
  }

  /**
   * Create middleware for parameter constraint validation
   */
  private _createConstraintMiddleware(
    constraints: Record<string, RegExp>
  ): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      for (const [param, pattern] of Object.entries(constraints)) {
        const value = req.params[param];
        if (value && !pattern.test(value)) {
          return res.status(404).json({
            error: "Not Found",
            message: `Parameter '${param}' does not match required pattern`,
          });
        }
      }
      next();
    };
  }

  /**
   * Resolve middleware to RequestHandler
   */
  private _resolveMiddleware(middleware: any): RequestHandler {
    if (typeof middleware === "function" && !middleware.prototype?.handle) {
      // It's a standard express middleware function
      return middleware;
    }

    if (Array.isArray(middleware) && middleware.length === 2) {
      // It's [MiddlewareClass, 'method']
      const [middlewareClass, method] = middleware;
      return MiddlewareBinder.handle(middlewareClass, method);
    }

    if (
      typeof middleware === "function" ||
      (typeof middleware === "object" && middleware !== null)
    ) {
      // It's a Middleware Class (constructor) or instance
      // Default to 'handle' method
      return MiddlewareBinder.handle(middleware, "handle");
    }

    throw new Error(
      "Invalid middleware. Must be a function, [Class, 'method'], or Class."
    );
  }

  /**
   * Build the full path with prefixes
   */
  private _buildPath(path: string): string {
    const cleanPath = path.replace(/^\//, "");
    const prefixes = this.prefixStack.filter((p) => p !== "");

    if (prefixes.length === 0) {
      return `/${cleanPath}`;
    }

    return `/${prefixes.join("/")}/${cleanPath}`.replace(/\/+/g, "/");
  }

  /**
   * Build the route handler
   */
  private _buildHandler(action: any): RequestHandler {
    if (typeof action === "function") {
      return action;
    }

    if (Array.isArray(action) && action.length === 2) {
      const [controller, method] = action;
      return ControllerBinder.handle(controller, method);
    }

    throw new Error(
      'Action must be a function or array [Controller, "method"]'
    );
  }
}

/**
 * Static Route class for ArcanaJS Routing
 */
export class Route {
  private static _router = new ArcanaJSRouter();
  private static _allRoutes: RouteDefinition[] = [];

  static middleware(...middleware: any[]): typeof Route {
    this._router = this._router.middleware(...middleware);
    return this;
  }

  static prefix(prefix: string): typeof Route {
    this._router = this._router.prefix(prefix);
    return this;
  }

  /**
   * Mark following routes as API-only (JSON responses)
   */
  static api(): typeof Route {
    this._router = this._router.api();
    return this;
  }

  static group(callback: (router: ArcanaJSRouter) => void): typeof Route {
    this._router.group(callback);
    return this;
  }

  static get(path: string, ...args: any[]): RouteBuilder {
    return this._router.get(path, ...args);
  }

  static post(path: string, ...args: any[]): RouteBuilder {
    return this._router.post(path, ...args);
  }

  static put(path: string, ...args: any[]): RouteBuilder {
    return this._router.put(path, ...args);
  }

  static delete(path: string, ...args: any[]): RouteBuilder {
    return this._router.delete(path, ...args);
  }

  static patch(path: string, ...args: any[]): RouteBuilder {
    return this._router.patch(path, ...args);
  }

  static options(path: string, ...args: any[]): RouteBuilder {
    return this._router.options(path, ...args);
  }

  static resource(
    path: string,
    controller: any,
    options?: { only?: string[]; except?: string[] }
  ): typeof Route {
    this._router.resource(path, controller, options);
    return this;
  }

  /**
   * Define a redirect route
   *
   * @example
   * Route.redirect('/old-path', '/new-path');
   * Route.redirect('/legacy', '/modern', 301);
   */
  static redirect(
    from: string,
    to: string,
    status: number = 302
  ): typeof Route {
    this._router.get(from, (req: Request, res: Response) => {
      // Check if this is an ArcanaJS SPA request
      const isArcanaRequest = req.headers["x-arcanajs-request"] === "true";

      if (isArcanaRequest) {
        // For SPA navigation, return JSON with redirect info
        res.json({
          redirect: true,
          url: to,
          status,
        });
      } else {
        // For SSR/traditional navigation, use HTTP redirect
        res.redirect(status, to);
      }
    });
    return this;
  }

  /**
   * Define a permanent redirect (301)
   *
   * @example
   * Route.permanentRedirect('/old', '/new');
   */
  static permanentRedirect(from: string, to: string): typeof Route {
    return this.redirect(from, to, 301);
  }

  /**
   * Generate URL for a named route
   *
   * @example
   * Route.urlFor('user.show', { id: 1 }); // => '/users/1'
   */
  static urlFor(
    name: string,
    params: Record<string, string | number> = {}
  ): string {
    const route = RouteRegistry.get(name);
    if (!route) {
      throw new Error(
        `Route '${name}' not found. Make sure to define routes with .name('${name}')`
      );
    }

    let url = route.path;

    // Replace named parameters
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, String(value));
    }

    // Check for any remaining unresolved parameters
    const unresolvedParams = url.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (unresolvedParams) {
      throw new Error(
        `Missing required parameters: ${unresolvedParams.join(", ")}`
      );
    }

    return url;
  }

  /**
   * Check if a named route exists
   */
  static hasRoute(name: string): boolean {
    return RouteRegistry.has(name);
  }

  /**
   * List all registered routes
   *
   * @example
   * const routes = Route.list();
   * console.table(routes);
   */
  static list(): Array<{ method: string; path: string; name?: string }> {
    return this._allRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      name: r.name,
    }));
  }

  /**
   * Print all routes to console in a formatted table
   */
  static printRoutes(): void {
    const routes = this.list();
    console.log("\n📍 Registered Routes:\n");
    console.log("─".repeat(60));
    console.log("METHOD".padEnd(10) + "PATH".padEnd(35) + "NAME");
    console.log("─".repeat(60));
    for (const route of routes) {
      console.log(
        route.method.padEnd(10) + route.path.padEnd(35) + (route.name || "-")
      );
    }
    console.log("─".repeat(60));
    console.log(`Total: ${routes.length} routes\n`);
  }

  static getRouter(): ExpressRouter {
    const router = this._router.getRouter();
    this._allRoutes = [...this._allRoutes, ...this._router.getRoutes()];
    this._router = new ArcanaJSRouter(); // Reset for next use
    return router;
  }
}

export { RouteRegistry };
export default Route;
