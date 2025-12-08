import HomeController from "@/app/Http/Controllers/HomeController";
import { LoggerMiddleware } from "@/app/Http/Middleware/LoggerMiddleware";
import { Route } from "arcanajs/server";

Route.middleware(LoggerMiddleware).get("/", [HomeController, "index"]);

export default Route.getRouter();
