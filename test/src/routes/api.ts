import HomeController from "@/app/Http/Controllers/HomeController";
import TestController from "@/app/Http/Controllers/TestController";
import UserController from "@/app/Http/Controllers/UserController";
import { LoggerMiddleware } from "@/app/Http/Middleware/LoggerMiddleware";
import { Route } from "arcanajs/server";

Route.middleware(LoggerMiddleware).group((Route) => {
  Route.get("/", [HomeController, "api"]);
  Route.get("/users/:id", [UserController, "index"]);
});

Route.middleware(LoggerMiddleware).post("/test/submit", [
  TestController,
  "submit",
]);

export default Route.getRouter();
