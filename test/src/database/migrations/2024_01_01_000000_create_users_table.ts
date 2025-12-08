import { Migration, Schema } from "arcanajs/arcanox";

/**
 * Create users table migration
 */
export class CreateUsersTable extends Migration {
  /**
   * Run the migration
   */
  async up(): Promise<void> {
    await Schema.create("users", (table) => {
      table.id();
      table.string("name");
      table.string("email").unique();
      table.string("password");
      table.string("status").default("active");
      table.timestamp("email_verified_at").nullable();

      table.timestamps();
      table.softDeletes();
    });
  }

  /**
   * Reverse the migration
   */
  async down(): Promise<void> {
    await Schema.dropIfExists("users");
  }
}

export default CreateUsersTable;
