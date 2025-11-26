import { ArcanaJSServer } from "../../lib/server";
import webRoutes from "./routes/web";

const server = new ArcanaJSServer({
  routes: webRoutes,
  viewsDir: "src/example/views",
});

server.start();
