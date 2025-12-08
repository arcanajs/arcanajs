import { Factory } from "arcanajs/arcanox";
import User from "@/app/Models/User";

/**
 * User Factory
 */
class UserFactory extends Factory<User> {
  protected model = User;

  definition() {
    return {
      name: this.faker.person.fullName(),
      email: this.faker.internet.email(),
      password: "password", // In a real app, hash this
      status: "active",
      email_verified_at: new Date(),
    };
  }
}

export default UserFactory;
