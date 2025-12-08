import { Service } from "arcanajs/server";
import UserRepository from "../Repositories/UserRepository";

@Service()
class UserService {
  constructor(private userRepository: UserRepository) {}
  async findById(id: string) {
    return await this.userRepository.findById(id);
  }
}
export default UserService;
