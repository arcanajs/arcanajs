import HomeController from "@/app/Http/Controllers/HomeController";
import { LoggerMiddleware } from "@/app/Http/Middleware/LoggerMiddleware";
import { Request, Response, Route } from "arcanajs/server";

Route.middleware(LoggerMiddleware).get("/", [HomeController, "index"]);
Route.middleware(LoggerMiddleware).get(
  "/test",
  (_req: Request, res: Response) => {
    res.renderPage("Test");
  }
);

export default Route.getRouter();
