import { Request, Response } from "express";

export default class UserController {
  /**
   * Handle GET /users
   * Affiche la liste des utilisateurs
   */
  index(req: Request, res: Response) {
    // Exemple de données (normalement venant d'une BDD)
    const usersList = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "123", name: "Charlie" },
    ];

    // Rendre la page "users/index" avec les données
    res.renderPage("users/index", { users: usersList });
  }

  /**
   * Handle GET /users/:id
   */
  show(req: Request, res: Response) {
    // Access route parameters via req.params
    const userId = req.params.id;

    // You can fetch data from a database here
    const user = {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
    };

    // Return JSON data (API)
    // res.json(user);

    // OR Render a page with this data (SSR)
    res.renderPage("users/[id]", { user }, req.params);
  }
}
