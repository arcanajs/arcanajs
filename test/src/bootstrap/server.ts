import { AppServiceProvider } from "@/app/Providers/AppServiceProvider";
import databaseConfig from "@/config/database";
import apiRoutes from "@/routes/api";
import webRoutes from "@/routes/web";
import { DatabaseProvider } from "arcanajs/arcanox";
import { ArcanaJSServer } from "arcanajs/server";

const PORT = process.env.PORT || 3000;

const server = new ArcanaJSServer({
  port: Number(PORT),
  routes: webRoutes,
  apiRoutes: apiRoutes,
  apiBase: "/api",
  autoDiscovery: {
    enabled: true,
    debug: true, // Optional: enable debug logging
  },
  database: databaseConfig,
  providers: [AppServiceProvider, DatabaseProvider],
});

server.start();
