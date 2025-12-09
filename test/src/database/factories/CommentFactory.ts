import Comment from "@/app/Models/Comment";
import { Factory } from "arcanajs/arcanox";
import UserFactory from "./UserFactory";

/**
 * Comment Factory
 */
class CommentFactory extends Factory<Comment> {
  protected model = Comment;
  protected relations = {
    user: { factory: UserFactory, numberOfEntities: 6 },
  };

  definition() {
    return {
      content: this.faker.lorem.sentence(),
      user_id: this.related("user").id,
    };
  }
}

export default CommentFactory;
