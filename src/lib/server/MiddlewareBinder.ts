import { NextFunction, Request, Response } from "express";

import { container } from "../di/Container";

export default class MiddlewareBinder {
  static handle(middleware: any, method: string = "handle") {
    // Instantiate the middleware once (Singleton pattern) for performance
    let instance: any;
    try {
      instance = container.make(middleware);
    } catch (e) {
      // Fallback if middleware is not a class or fails to instantiate
      instance = middleware;
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Call the method
        if (typeof instance[method] === "function") {
          await instance[method](req, res, next);
        } else {
          throw new Error(
            `Method ${method} not found on middleware ${middleware.name}`
          );
        }
      } catch (error) {
        next(error);
      }
    };
  }
}
