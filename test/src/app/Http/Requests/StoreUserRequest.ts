import { FormRequest } from "arcanajs/validator";

export class StoreUserRequest extends FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  public authorize(): boolean {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   */
  public rules(): Record<string, string> {
    return {
      username: "required|string|min:3|max:20",
      email: "required|email",
      password: "required|string|min:8",
      age: "numeric|min:18",
    };
  }
}
