import { Request, Response } from "express";

export default class HomeController {
  index(req: Request, res: Response) {
    res.renderPage("HomePage", { title: "Welcome Home" });
  }

  user(req: Request, res: Response) {
    res.renderPage("UserPage", {
      username: "JohnDoe",
      role: "Admin",
      timestamp: Date.now(),
    });
  }

  test(req: Request, res: Response) {
    res.renderPage("TestPage", {
      message: "This is a test page",
      timestamp: Date.now(),
    });
  }

  dashboardUsers(req: Request, res: Response) {
    res.renderPage("dashboard/UsersPage", {
      title: "Welcome From Dashboard",
      users: ["Alice", "Bob", "Charlie"],
    });
  }

  auditLog(req: Request, res: Response) {
    res.renderPage("admin/settings/security/AuditLog", {
      logs: ["Login attempt failed", "Password changed", "User created"],
    });
  }
}
