import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";

export class AuthenticatedMiddleware implements Middleware {
  handle(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      if (
        req.get("X-ArcanaJS-Request") ||
        req.xhr ||
        req.headers.accept?.indexOf("json")! > -1
      ) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      // Redirect to login if not JSON request?
      // For now, let's just return 401 or maybe redirect if we had a route helper
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    next();
  }
}
