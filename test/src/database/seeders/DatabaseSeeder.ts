import { Seeder } from "arcanajs/arcanox";
import { UserSeeder } from "./UserSeeder";

/**
 * Database Seeder
 * Entry point for all seeders
 */
export class DatabaseSeeder extends Seeder {
  async run() {
    await this.call(UserSeeder);
  }
}

export default DatabaseSeeder;
