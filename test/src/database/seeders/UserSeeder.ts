import UserFactory from "@/database/factories/UserFactory";
import { Seeder } from "arcanajs/arcanox";

/**
 * User Seeder
 */
export class UserSeeder extends Seeder {
  async run() {
    const factory = new UserFactory();
    await factory.createMany(10);
  }
}

export default UserSeeder;
