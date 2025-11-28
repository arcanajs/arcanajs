import { ArcanaJSServer } from "arcanajs/server";
import apiRoutes from "./routes/api";
import webRoutes from "./routes/web";

// Example DB connectors included in templates:
// import mongoDb from '../db/mongo';
// import mongooseDb from '../db/mongoose';
// import pgDb from '../db/postgres';
// import mysqlDb from '../db/mysql';

const PORT = process.env.PORT || 3000;

const server = new ArcanaJSServer({
  port: PORT,
  routes: webRoutes,
  // Separate API routes (mounted under /api by default)
  apiRoutes: apiRoutes,
  // To change the base path, set apiBase: '/v1' for example or similar
  apiBase: "/api",
  // Example: provide a dbConnect function that returns the DB client/connection.
  // You can connect to MySQL/Postgres/MongoDB here and return the client.
  // dbConnect: async () => {
  //   const { MongoClient } = await import('mongodb');
  //   const client = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
  //   await client.connect();
  //   return client.db('mydb');
  // },
  // Or use one of the provided DB templates (uncomment one):
  // dbConnect: mongoDb,
  // dbConnect: mongooseDb,
  // dbConnect: pgDb,
  // dbConnect: mysqlDb,
});

server.start();
