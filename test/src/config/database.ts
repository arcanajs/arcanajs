/**
 * Database Configuration
 *
 * Configure your database connection here.
 * Supports PostgreSQL, MySQL, MongoDB, SQLite, and MariaDB.
 *
 * Arcanox ORM/ODM - Professional Database Configuration
 */
import { DatabaseConfig } from "arcanajs/arcanox";

/**
 * Environment-based database configuration
 * Switch database types easily by changing DB_TYPE environment variable
 */
const databaseType =
  (process.env.DB_TYPE as DatabaseConfig["type"]) || "mongodb";

/**
 * PostgreSQL Configuration
 */
const postgresConfig: DatabaseConfig = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "arcanajs",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",

  // SSL Configuration
  ssl:
    process.env.DB_SSL === "true"
      ? {
          enabled: true,
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
          // ca: process.env.DB_SSL_CA,
          // cert: process.env.DB_SSL_CERT,
          // key: process.env.DB_SSL_KEY,
        }
      : false,

  // Connection Pool
  pool: {
    min: Number(process.env.DB_POOL_MIN || "2"),
    max: Number(process.env.DB_POOL_MAX || "10"),
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
  },

  // PostgreSQL-specific options
  schema: process.env.DB_SCHEMA || "public",
  applicationName: "arcanajs",
  statementTimeout: 30000,

  // Query logging
  logging:
    process.env.NODE_ENV === "development"
      ? {
          queries: true,
          errors: true,
          slowQueries: true,
          connections: true,
        }
      : {
          queries: false,
          errors: true,
          slowQueries: true,
        },
  slowQueryThreshold: 1000,

  // Connection options
  connectTimeout: 10000,
  keepAlive: true,
  keepAliveInitialDelay: 10000,
};

/**
 * MySQL/MariaDB Configuration
 */
const mysqlConfig: DatabaseConfig = {
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "3306"),
  database: process.env.DB_NAME || "arcanajs",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",

  // SSL Configuration
  ssl:
    process.env.DB_SSL === "true"
      ? {
          enabled: true,
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : false,

  // Connection Pool
  pool: {
    min: Number(process.env.DB_POOL_MIN || "2"),
    max: Number(process.env.DB_POOL_MAX || "10"),
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },

  // MySQL-specific options
  charset: "utf8mb4",
  collation: "utf8mb4_unicode_ci",
  timezone: process.env.DB_TIMEZONE || "UTC",
  dateStrings: false,
  multipleStatements: false,

  // Query logging
  logging: process.env.NODE_ENV === "development",
  slowQueryThreshold: 1000,

  // Connection options
  connectTimeout: 10000,
};

/**
 * MongoDB Configuration
 */
const mongoConfig: DatabaseConfig = {
  type: "mongodb",
  database: process.env.DB_NAME || "arcanajs",

  // Connection string (recommended for MongoDB Atlas)
  uri:
    process.env.DB_URI ||
    "mongodb+srv://mohammedbencheikhdev_db_user:C0thLYy6H23fLjHQ@arcanajs.jd8mbmh.mongodb.net",

  // Alternative: Individual connection parameters
  // host: process.env.DB_HOST || "localhost",
  // port: Number(process.env.DB_PORT || "27017"),
  // username: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,

  // SSL/TLS Configuration
  ssl:
    process.env.DB_SSL === "true"
      ? {
          enabled: true,
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : undefined,

  // Connection Pool
  pool: {
    min: Number(process.env.DB_POOL_MIN || "2"),
    max: Number(process.env.DB_POOL_MAX || "10"),
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },

  // MongoDB-specific options
  authSource: process.env.DB_AUTH_SOURCE || "admin",
  replicaSet: process.env.DB_REPLICA_SET,
  retryWrites: true,
  w: "majority",
  journal: true,
  readPreference: "primary",
  readConcern: "majority",
  writeConcern: {
    w: "majority",
    j: true,
    wtimeout: 10000,
  },

  // Query logging
  logging:
    process.env.NODE_ENV === "development"
      ? {
          queries: true,
          errors: true,
          slowQueries: true,
          connections: true,
        }
      : {
          queries: false,
          errors: true,
          slowQueries: true,
        },
  slowQueryThreshold: 1000,

  // Connection options
  connectTimeout: 10000,
  socketTimeout: 360000,
  keepAlive: true,
  keepAliveInitialDelay: 300000,

  // Debug mode
  debug: process.env.NODE_ENV === "development",
};

/**
 * Configuration map by database type
 */
const configMap: Record<string, DatabaseConfig> = {
  postgres: postgresConfig,
  postgresql: postgresConfig,
  mysql: mysqlConfig,
  mariadb: { ...mysqlConfig, type: "mariadb" },
  mongodb: mongoConfig,
  mongo: mongoConfig,
};

/**
 * Export the active database configuration
 */
const databaseConfig: DatabaseConfig = configMap[databaseType] || mongoConfig;

export default databaseConfig;

/**
 * Export individual configurations for multi-database setups
 */
export { mongoConfig, mysqlConfig, postgresConfig };
