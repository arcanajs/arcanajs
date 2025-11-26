import Route from "../../../lib/server/Router";
import HomeController from "../controllers/HomeController";
import UserController from "../controllers/UserController";

Route.get("/", [HomeController, "index"]);
Route.get("/user", [HomeController, "user"]);
Route.get("/test", [HomeController, "test"]);
Route.get("/dashboard/users", [HomeController, "dashboardUsers"]);
Route.get("/admin/audit", [HomeController, "auditLog"]);

// Example of Controller with parameters
// The syntax :id is used for parameters in Express/Server routes
Route.get("/users", [UserController, "index"]);
Route.get("/users/:id", [UserController, "show"]);

export default Route.getRouter();
