/**
 * Database Configuration
 *
 * Configure your database connection here.
 * Supports PostgreSQL, MySQL, and MongoDB.
 */
import { DatabaseConfig } from "arcanajs/arcanox";

const databaseConfig: DatabaseConfig = {
  type: "mongodb",
  // host: process.env.DB_HOST || "localhost",
  // port: Number(process.env.DB_PORT || "27017"),
  database: process.env.DB_NAME || "arcanajs",
  uri: "mongodb+srv://mohammedbencheikhdev_db_user:C0thLYy6H23fLjHQ@arcanajs.jd8mbmh.mongodb.net",
  // username: process.env.DB_USER || "",
  // password: process.env.DB_PASSWORD || "password",
  // ssl: process.env.DB_SSL === "true",
  pool: {
    min: 2,
    max: 10,
  },
};

export default databaseConfig;
