import { HomePageData } from "@/types/HomePageData";
import type { Request, Response } from "arcanajs/server";
class HomeController {
  async index(_req: Request, res: Response) {
    try {
      // Provide example page data to demonstrate passing data to the view
      const data: HomePageData = {
        welcome: "Welcome to ArcanaJS",
        subtitle: "A modern React framework with server-side rendering",
        time: new Date().toISOString(),
        posts: [
          { id: 1, title: "Getting started with ArcanaJS" },
          { id: 2, title: "Building fast apps with SSR" },
        ],
      };
      res.renderPage("HomePage", data);
    } catch (error) {
      res.error("Failed to retrieve users", 500, error);
    }
  }

  async api(_req: Request, res: Response) {
    try {
      res.success(
        { name: "ArcanaJS", type: "framework" },
        "Users retrieved successfully",
        200
      );
    } catch (error) {
      res.error("Failed to retrieve users", 500, error);
    }
  }
}

export default HomeController;
