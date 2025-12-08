import { Request } from "express";
import { Validator } from "../Validator";

export abstract class FormRequest {
  protected req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  abstract rules(): Record<string, string>;

  authorize(): boolean {
    return true;
  }

  async validate(): Promise<Record<string, any>> {
    if (!this.authorize()) {
      throw new Error("This action is unauthorized.");
    }

    const validator = Validator.make(this.req.body, this.rules());

    // This will throw ValidationException if fails
    return validator.validate();
  }

  // Helper to access request data
  input(key: string, defaultValue: any = null): any {
    return this.req.body[key] || defaultValue;
  }

  all(): any {
    return this.req.body;
  }
}
