import { QueryBuilder } from "../arcanox/QueryBuilder";
import type { DatabaseAdapter } from "../arcanox/types";
import { ValidationException } from "./ValidationException";

export class Validator {
  protected data: any;
  protected rules: Record<string, string>;
  protected errors: Record<string, string[]> = {};
  protected databaseAdapter?: DatabaseAdapter;

  /**
   * Map of custom validator functions.
   */
  private static customValidators: Record<
    string,
    (
      value: any,
      data: any,
      param?: string
    ) => true | string | Promise<true | string>
  > = {};

  /**
   * Register a custom validator.
   */
  public static registerValidator(
    name: string,
    fn: (
      value: any,
      data: any,
      param?: string
    ) => true | string | Promise<true | string>
  ): void {
    Validator.customValidators[name] = fn;
  }

  constructor(data: any, rules: Record<string, string>) {
    this.data = data;
    this.rules = rules;
  }

  static make(data: any, rules: Record<string, string>): Validator {
    return new Validator(data, rules);
  }

  /**
   * Set the database adapter for database validation rules
   */
  setDatabaseAdapter(adapter: DatabaseAdapter): this {
    this.databaseAdapter = adapter;
    return this;
  }

  async fails(): Promise<boolean> {
    await this.validateRules();
    return Object.keys(this.errors).length > 0;
  }

  async passes(): Promise<boolean> {
    return !(await this.fails());
  }

  errors_(): Record<string, string[]> {
    return this.errors;
  }

  async validate(): Promise<Record<string, any>> {
    const validated = await this.validateRules();

    if (Object.keys(this.errors).length > 0) {
      throw new ValidationException(this.errors);
    }

    return validated;
  }

  protected async validateRules(): Promise<Record<string, any>> {
    this.errors = {};
    const validated: Record<string, any> = {};

    // Auto-inject database adapter if needed and not already set
    if (!this.databaseAdapter && this.needsDatabaseAdapter()) {
      await this.autoInjectDatabaseAdapter();
    }

    for (const [field, ruleString] of Object.entries(this.rules)) {
      const rules = ruleString.split("|");
      const value = this.getValue(field);

      for (const rule of rules) {
        await this.applyRule(field, value, rule);
      }

      if (value !== undefined) {
        validated[field] = value;
      }
    }

    return validated;
  }

  /**
   * Check if any rules require database adapter
   */
  protected needsDatabaseAdapter(): boolean {
    for (const ruleString of Object.values(this.rules)) {
      const rules = ruleString.split("|");
      for (const rule of rules) {
        const ruleName = rule.split(":")[0];
        if (ruleName === "unique" || ruleName === "exists") {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Auto-inject database adapter from Container
   */
  protected async autoInjectDatabaseAdapter(): Promise<void> {
    try {
      // Dynamically import Container to avoid circular dependencies
      const { Container } = await import("../di/Container");
      const container = Container.getInstance();
      this.databaseAdapter = await container.make("DatabaseAdapter");
    } catch (error) {
      // If Container or DatabaseAdapter is not available, throw a helpful error
      throw new Error(
        "Database adapter not available. Ensure DatabaseProvider is registered in your application."
      );
    }
  }

  protected getValue(field: string): any {
    return field.split(".").reduce((obj, key) => obj?.[key], this.data);
  }

  protected async applyRule(
    field: string,
    value: any,
    rule: string
  ): Promise<void> {
    const [ruleName, ...params] = rule.split(":");
    const param = params.join(":"); // Rejoin in case param contains colons

    // Skip validation if value is missing and rule is not 'required'
    if (this.isEmpty(value) && ruleName !== "required") {
      return;
    }

    switch (ruleName) {
      case "required":
        if (this.isEmpty(value)) this.addError(field, `${field} is required.`);
        break;
      case "string":
        if (typeof value !== "string")
          this.addError(field, `${field} must be a string.`);
        break;
      case "numeric":
        if (isNaN(Number(value)))
          this.addError(field, `${field} must be a number.`);
        break;
      case "integer":
        if (!Number.isInteger(Number(value)))
          this.addError(field, `${field} must be an integer.`);
        break;
      case "float":
        if (isNaN(parseFloat(value)))
          this.addError(field, `${field} must be a float.`);
        break;
      case "boolean":
        if (
          typeof value !== "boolean" &&
          value !== "true" &&
          value !== "false" &&
          value !== 0 &&
          value !== 1
        ) {
          this.addError(field, `${field} must be a boolean.`);
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          this.addError(field, `${field} must be an array.`);
        } else if (param) {
          // Handle array:type (e.g., array:string, array:object)
          await this.validateArrayContent(field, value, param);
        }
        break;
      case "object":
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value)
        ) {
          this.addError(field, `${field} must be an object.`);
        }
        break;
      case "json":
        if (!this.isValidJson(value))
          this.addError(field, `${field} must be a valid JSON string.`);
        break;
      case "email":
        // Safer email regex to prevent ReDoS
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(String(value)))
          this.addError(field, `${field} must be a valid email address.`);
        break;
      case "url":
        try {
          new URL(value);
        } catch {
          this.addError(field, `${field} must be a valid URL.`);
        }
        break;
      case "alpha":
        if (!/^[a-zA-Z]+$/.test(value))
          this.addError(field, `${field} must contain only letters.`);
        break;
      case "alpha_num":
        if (!/^[a-zA-Z0-9]+$/.test(value))
          this.addError(
            field,
            `${field} must contain only letters and numbers.`
          );
        break;
      case "min":
        this.validateMin(field, value, param);
        break;
      case "max":
        this.validateMax(field, value, param);
        break;
      case "in":
        const allowed = param.split(",");
        if (!allowed.includes(String(value)))
          this.addError(field, `${field} is invalid.`);
        break;
      case "not_in":
        const disallowed = param.split(",");
        if (disallowed.includes(String(value)))
          this.addError(field, `${field} is invalid.`);
        break;
      case "same":
        const otherValue = this.getValue(param);
        if (value !== otherValue)
          this.addError(field, `${field} must match ${param}.`);
        break;
      case "date":
        if (isNaN(Date.parse(value)))
          this.addError(field, `${field} must be a valid date.`);
        break;
      case "unique":
        await this.validateUnique(field, value, param);
        break;
      case "exists":
        await this.validateExists(field, value, param);
        break;
      default:
        // Custom validators
        const validatorFn = Validator.customValidators[ruleName];
        if (validatorFn) {
          const result = await validatorFn(value, this.data, param);
          if (result !== true) {
            this.addError(
              field,
              typeof result === "string"
                ? result
                : `${field} validation failed for ${ruleName}.`
            );
          }
        }
        break;
    }
  }

  protected async validateArrayContent(
    field: string,
    array: any[],
    type: string
  ): Promise<void> {
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      const itemField = `${field}.${i}`;

      // Recursively apply simple type checks
      // We construct a mini-rule for the item
      await this.applyRule(itemField, item, type);
    }
  }

  protected validateMin(field: string, value: any, param: string): void {
    const min = parseFloat(param);
    if (typeof value === "string" && value.length < min) {
      this.addError(field, `${field} must be at least ${min} characters.`);
    } else if (typeof value === "number" && value < min) {
      this.addError(field, `${field} must be at least ${min}.`);
    } else if (Array.isArray(value) && value.length < min) {
      this.addError(field, `${field} must have at least ${min} items.`);
    }
  }

  protected validateMax(field: string, value: any, param: string): void {
    const max = parseFloat(param);
    if (typeof value === "string" && value.length > max) {
      this.addError(
        field,
        `${field} must not be greater than ${max} characters.`
      );
    } else if (typeof value === "number" && value > max) {
      this.addError(field, `${field} must not be greater than ${max}.`);
    } else if (Array.isArray(value) && value.length > max) {
      this.addError(field, `${field} must not have more than ${max} items.`);
    }
  }

  protected isValidJson(value: any): boolean {
    if (typeof value !== "string") return false;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  protected isEmpty(value: any): boolean {
    return value === undefined || value === null || value === "";
  }

  /**
   * Validate unique rule: unique:table,column,ignoreId,ignoreColumn
   * Examples:
   * - unique:users,email
   * - unique:users,email,5 (ignore record with id=5)
   * - unique:users,email,5,user_id (ignore record where user_id=5)
   */
  protected async validateUnique(
    field: string,
    value: any,
    param: string
  ): Promise<void> {
    if (!this.databaseAdapter) {
      throw new Error(
        "Database adapter not set. Use setDatabaseAdapter() before using unique rule."
      );
    }

    const parts = param.split(",");
    const table = parts[0];
    const column = parts[1] || field;
    const ignoreId = parts[2];
    const ignoreColumn = parts[3] || "id";

    if (!table) {
      throw new Error(`Invalid unique rule format for ${field}`);
    }

    const query = new QueryBuilder(table, this.databaseAdapter);
    query.where(column, value);

    // Add ignore clause if provided
    if (ignoreId) {
      query.where(ignoreColumn, "!=", ignoreId);
    }

    const count = await query.count();

    if (count > 0) {
      this.addError(field, `The ${field} has already been taken.`);
    }
  }

  /**
   * Validate exists rule: exists:table,column
   * Example: exists:riads,id
   */
  protected async validateExists(
    field: string,
    value: any,
    param: string
  ): Promise<void> {
    if (!this.databaseAdapter) {
      throw new Error(
        "Database adapter not set. Use setDatabaseAdapter() before using exists rule."
      );
    }

    const parts = param.split(",");
    const table = parts[0];
    const column = parts[1] || "id";

    if (!table) {
      throw new Error(`Invalid exists rule format for ${field}`);
    }

    const query = new QueryBuilder(table, this.databaseAdapter);
    query.where(column, value);

    const exists = await query.exists();

    if (!exists) {
      this.addError(field, `The selected ${field} is invalid.`);
    }
  }

  protected addError(field: string, message: string) {
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(message);
  }
}
