import express, { Router as ExpressRouter, RequestHandler, Router } from "express";
import ControllerBinder from "./ControllerBinder";
import MiddlewareBinder from "./MiddlewareBinder";

/**
 * Provides Routing syntax for defining routes with prefixes, middlewares, and groups for ArcanaJS Framework
 */
export class ArcanaJSRouter {
  private router: ExpressRouter;
  private middlewareStack: RequestHandler[];
  private prefixStack: string[];

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
   * Create a route group
   */
  group(callback: (router: ArcanaJSRouter) => void): ArcanaJSRouter {
    callback(this);
    return this;
  }

  /**
   * Define a GET route
   */
  get(path: string, ...args: any[]): ArcanaJSRouter {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("get", path, action, middlewares);
  }

  /**
   * Define a POST route
   */
  post(path: string, ...args: any[]): ArcanaJSRouter {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("post", path, action, middlewares);
  }

  /**
   * Define a PUT route
   */
  put(path: string, ...args: any[]): ArcanaJSRouter {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("put", path, action, middlewares);
  }

  /**
   * Define a DELETE route
   */
  delete(path: string, ...args: any[]): ArcanaJSRouter {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("delete", path, action, middlewares);
  }

  /**
   * Define a PATCH route
   */
  patch(path: string, ...args: any[]): ArcanaJSRouter {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("patch", path, action, middlewares);
  }

  /**
   * Define an OPTIONS route
   */
  options(path: string, ...args: any[]): ArcanaJSRouter {
    const action = args.pop();
    const middlewares = args;
    return this._addRoute("options", path, action, middlewares);
  }

  /**
   * Define a resource route
   * Registers index, create, store, show, edit, update, destroy routes
   */
  resource(path: string, controller: any): ArcanaJSRouter {
    this.get(path, controller, "index");
    this.get(`${path}/create`, controller, "create");
    this.post(path, controller, "store");
    this.get(`${path}/:id`, controller, "show");
    this.get(`${path}/:id/edit`, controller, "edit");
    this.put(`${path}/:id`, controller, "update");
    this.patch(`${path}/:id`, controller, "update");
    this.delete(`${path}/:id`, controller, "destroy");
    return this;
  }

  /**
   * Get the underlying Express router
   */
  getRouter(): ExpressRouter {
    return this.router;
  }

  /**
   * Clone the current router instance
   */
  private _clone(): ArcanaJSRouter {
    const newRouter = new ArcanaJSRouter();
    newRouter.router = this.router;
    newRouter.middlewareStack = [...this.middlewareStack];
    newRouter.prefixStack = [...this.prefixStack];
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
  ): ArcanaJSRouter {
    const fullPath = this._buildPath(path);
    const handler = this._buildHandler(action);
    const flatMiddlewares = routeMiddlewares.flat(Infinity);
    const resolvedMiddlewares = flatMiddlewares.map((m) =>
      this._resolveMiddleware(m)
    );
    const middlewares = [
      ...this.middlewareStack,
      ...resolvedMiddlewares,
      handler,
    ];

    this.router[method](fullPath, ...middlewares);
    return this;
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

  static middleware(...middleware: any[]): typeof Route {
    this._router = this._router.middleware(...middleware);
    return this;
  }

  static prefix(prefix: string): typeof Route {
    this._router = this._router.prefix(prefix);
    return this;
  }

  static group(callback: (router: ArcanaJSRouter) => void): typeof Route {
    this._router.group(callback);
    return this;
  }

  static get(path: string, ...args: any[]): typeof Route {
    this._router.get(path, ...args);
    return this;
  }

  static post(path: string, ...args: any[]): typeof Route {
    this._router.post(path, ...args);
    return this;
  }

  static put(path: string, ...args: any[]): typeof Route {
    this._router.put(path, ...args);
    return this;
  }

  static delete(path: string, ...args: any[]): typeof Route {
    this._router.delete(path, ...args);
    return this;
  }

  static patch(path: string, ...args: any[]): typeof Route {
    this._router.patch(path, ...args);
    return this;
  }

  static options(path: string, ...args: any[]): typeof Route {
    this._router.options(path, ...args);
    return this;
  }

  static resource(path: string, controller: any): typeof Route {
    this._router.resource(path, controller);
    return this;
  }

  static getRouter(): ExpressRouter {
    const router = this._router.getRouter();
    this._router = new ArcanaJSRouter(); // Reset for next use
    return router;
  }
}

export default Route;
