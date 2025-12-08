import { NextFunction, Request, Response } from "express";

export interface Middleware {
  handle(req: Request, res: Response, next: NextFunction): void | Promise<void>;
}
