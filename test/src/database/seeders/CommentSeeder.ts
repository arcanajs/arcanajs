import CommentFactory from "@/database/factories/CommentFactory";
import { Seeder } from "arcanajs/arcanox";

export default class CommentSeeder extends Seeder {
  async run() {
    const factory = new CommentFactory();
    await factory.run();
  }
}
