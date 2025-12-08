import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";

export class GuestMiddleware implements Middleware {
  handle(req: Request, res: Response, next: NextFunction) {
    if (req.user) {
      if (
        req.get("X-ArcanaJS-Request") ||
        req.xhr ||
        req.headers.accept?.indexOf("json")! > -1
      ) {
        res.status(403).json({ message: "Already authenticated" });
        return;
      }
      res.redirect("/");
      return;
    }
    next();
  }
}
