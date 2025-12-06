import { RedisStore } from "connect-redis";
import session from "express-session";
import { createClient } from "redis";
import { AuthConfig } from "./types";

export class SessionManager {
  static createMiddleware(config: AuthConfig["session"]) {
    let store;

    if (config.redis) {
      const redisClient = createClient({
        url: `redis://${
          config.redis.password ? `:${config.redis.password}@` : ""
        }${config.redis.host}:${config.redis.port}`,
      });

      redisClient.connect().catch(console.error);

      store = new RedisStore({
        client: redisClient,
        prefix: "arcanajs:sess:",
      });
    }

    return session({
      store: store,
      name: config.name || "arcanajs.sid",
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.secure ?? process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: config.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
      },
    });
  }
}
