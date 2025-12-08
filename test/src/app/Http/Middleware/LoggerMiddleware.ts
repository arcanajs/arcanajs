import { Middleware, NextFunction, Request, Response } from "arcanajs/server";

export class LoggerMiddleware implements Middleware {
  public handle(req: Request, _res: Response, next: NextFunction): void {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${
        req.baseUrl === "" ? "/" : req.baseUrl
      }`
    );
    next();
  }
}
