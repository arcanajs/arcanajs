import { Route } from "arcanajs/server";
import UsersController from "../controllers/UsersController";

router.get("/users", [UsersController, "users"]);

export default Route.getRouter();
