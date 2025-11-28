import { Request, Response } from "express";

export default class HomeController {
  home(req: Request, res: Response) {
    res.renderPage("HomePage");
  }
}
