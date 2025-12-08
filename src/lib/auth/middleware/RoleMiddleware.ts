import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";

export class RoleMiddleware implements Middleware {
  private roles: string[];

  constructor(...roles: string[]) {
    this.roles = roles;
  }

  handle(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = this.roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  }
}
