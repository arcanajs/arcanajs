import { Model } from "arcanajs/arcanox";
import User from "./User";

class Comment extends Model {
  protected table = "comments";
  protected fillable = ["content", "user_id"];
  protected timestamps = true;

  protected casts = {
    user_id: "objectId",
  };

  user() {
    return this.belongsTo(User);
  }
}
export default Comment;
