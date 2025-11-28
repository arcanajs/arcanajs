import { Route } from "arcanajs/server";

import HomeController from "../controllers/HomeController";

Route.get("/", [HomeController, "home"]);

export default Route.getRouter();
