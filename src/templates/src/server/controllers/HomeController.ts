import { Request, Response } from "arcanajs/server";
import type { HomePageData } from "../../types/HomePageData";

export default class HomeController {
  home(_req: Request, res: Response) {
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
  }
}
