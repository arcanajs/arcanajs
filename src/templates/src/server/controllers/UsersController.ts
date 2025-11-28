import { Request, Response } from "express";

/**
 * UsersController - example controller for users endpoints.
 */
export default class UsersController {
  async users(req: Request, res: Response) {
    try {
      const normalized: any = (req as any).db || req.app?.locals?.db;
      if (!normalized) return res.error("No DB connection", 500, null, null);

      const client: any = normalized.client || normalized;
      const db: any = normalized.db || normalized;

      if (db && typeof db.collection === "function") {
        const users = await db.collection("users").find().toArray();
        return res.success(users, "Users retrieved successfully", 200);
      }

      if (client && typeof client.query === "function") {
        const result = await client.query("SELECT * FROM users LIMIT 100");
        const rows = result.rows || result[0] || result;
        return res.success(rows, "Users retrieved successfully", 200);
      }

      return res.error(
        "Unsupported DB client in template example",
        400,
        null,
        null
      );
    } catch (err) {
      console.error(err);
      return res.error("Query failed", 500, err as any, null);
    }
  }
}
