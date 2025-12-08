import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";
import { JWTService } from "../JWTService";

export class AuthMiddleware implements Middleware {
  async handle(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      let token = "";

      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }

      if (!token) {
        return next();
      }

      const payload = await JWTService.verifyToken(token);
      req.user = payload;
      req.token = token;
      next();
    } catch (err) {
      // Token invalid or expired, just proceed without user
      // Guards/AuthenticatedMiddleware will handle 401 if needed
      next();
    }
  }
}
