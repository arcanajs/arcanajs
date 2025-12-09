import { Blueprint, Migration, Schema } from "arcanajs/arcanox";

export default class CreateCommentsTable extends Migration {
  async up() {
    await Schema.create("comments", (table: Blueprint) => {
      table.id();
      table.string("content");
      table.objectId("user_id");
      table.foreign("user_id").references("id").on("users").onDelete("CASCADE");
      table.timestamps();
    });
  }

  async down() {
    await Schema.dropIfExists("comments");
  }
}
