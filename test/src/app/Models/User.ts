import { Model } from "arcanajs/arcanox";
import Comment from "./Comment";

/**
 * User Model
 *
 * Example Arcanox model demonstrating:
 * - Fillable attributes
 * - Hidden attributes (password)
 * - Timestamps
 * - Soft deletes
 * - Accessors
 */
class User extends Model {
  protected table = "users";
  protected fillable = ["name", "email", "password"];
  protected hidden = ["password"];
  protected timestamps = true;
  protected softDeletes = true;

  comments() {
    return this.hasMany(Comment);
  }

  // Attribute casting
  protected casts = {
    email_verified_at: "datetime",
  };

  /**
   * Accessor: Get full name
   */
  get fullName(): string {
    return this.getAttribute("name");
  }

  /**
   * Mutator: Hash password before saving
   */
  setPasswordAttribute(value: string): string {
    // In production, use bcrypt or similar
    return value; // Placeholder
  }

  /**
   * Scope: Get only active users
   */
  static active() {
    return this.where("status", "active");
  }

  /**
   * Scope: Get only verified users
   */
  static verified() {
    return this.query().whereNotNull("email_verified_at");
  }
}

export default User;
