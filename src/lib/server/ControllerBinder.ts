import { NextFunction, Request, Response } from "express";

import { container } from "../di/Container";

export default class ControllerBinder {
  static handle(controller: any, method: string) {
    // Instantiate the controller once (Singleton pattern) for performance
    // This assumes controllers are stateless, which is best practice.
    let instance: any;
    try {
      instance = container.make(controller);
    } catch (e) {
      // Fallback if controller is not a class or fails to instantiate
      console.warn(`Failed to instantiate controller ${controller.name}`, e);
      instance = controller;
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Call the method
        if (typeof instance[method] === "function") {
          await instance[method](req, res, next);
        } else {
          throw new Error(
            `Method ${method} not found on controller ${controller.name}`
          );
        }
      } catch (error) {
        next(error);
      }
    };
  }
}
