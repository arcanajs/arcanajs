import UserService from "@/app/Services/UserService";
import { Controller, type Request, type Response } from "arcanajs/server";
@Controller()
class UserController {
  constructor(private userService: UserService) {}

  async index(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      console.log(userId);
      const user = await this.userService.findById(userId);

      if (!user) {
        return res.error();
      }

      return res.success(user, "User retrieved successfully");
    } catch (error) {
      return res.error(
        "An error occurred while retrieving the user",
        500,
        error
      );
    }
  }
}

export default UserController;
