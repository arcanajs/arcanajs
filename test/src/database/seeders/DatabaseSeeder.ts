import { Seeder } from "arcanajs/arcanox";
import CommentSeeder from "./CommentSeeder";
import { UserSeeder } from "./UserSeeder";

/**
 * Database Seeder
 * Entry point for all seeders
 */
export class DatabaseSeeder extends Seeder {
  async run() {
    await this.call(UserSeeder);
    await this.call(CommentSeeder);
  }
}

export default DatabaseSeeder;
