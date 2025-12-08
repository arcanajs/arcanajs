import HomeController from "@/app/Http/Controllers/HomeController";
import UserController from "@/app/Http/Controllers/UserController";
import { LoggerMiddleware } from "@/app/Http/Middleware/LoggerMiddleware";
import { Route } from "arcanajs/server";

Route.middleware(LoggerMiddleware).group((Route) => {
  Route.get("/", [HomeController, "api"]);
  Route.get("/users/:id", [UserController, "index"]);
});

export default Route.getRouter();
