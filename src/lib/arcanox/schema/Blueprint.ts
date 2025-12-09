import type { ColumnDefinition } from "../types";

/**
 * Column definition builder - fluent interface for defining columns
 */
export class ColumnBuilder {
  private definition: ColumnDefinition;

  constructor(name: string, type: string, length?: number) {
    this.definition = {
      name,
      type,
      length,
      nullable: false,
    };
  }

  /**
   * Make column nullable
   */
  nullable(): this {
    this.definition.nullable = true;
    return this;
  }

  /**
   * Set default value
   */
  default(value: any): this {
    this.definition.default = value;
    return this;
  }

  /**
   * Make column unique
   */
  unique(): this {
    this.definition.unique = true;
    return this;
  }

  /**
   * Make column primary key
   */
  primary(): this {
    this.definition.primary = true;
    return this;
  }

  /**
   * Make column auto-increment
   */
  autoIncrement(): this {
    this.definition.autoIncrement = true;
    return this;
  }

  /**
   * Make column unsigned (for numbers)
   */
  unsigned(): this {
    this.definition.unsigned = true;
    return this;
  }

  /**
   * Get the column definition
   */
  getDefinition(): ColumnDefinition {
    return this.definition;
  }
}

/**
 * Foreign key definition builder
 */
export class ForeignKeyBuilder {
  private column: string;
  private referencedTable?: string;
  private referencedColumn?: string;
  private onDeleteAction?: string;
  private onUpdateAction?: string;

  constructor(column: string) {
    this.column = column;
  }

  /**
   * Set referenced table and column
   */
  references(column: string): this {
    this.referencedColumn = column;
    return this;
  }

  /**
   * Set referenced table
   */
  on(table: string): this {
    this.referencedTable = table;
    return this;
  }

  /**
   * Set ON DELETE action
   */
  onDelete(action: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION"): this {
    this.onDeleteAction = action;
    return this;
  }

  /**
   * Set ON UPDATE action
   */
  onUpdate(action: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION"): this {
    this.onUpdateAction = action;
    return this;
  }

  /**
   * Get foreign key SQL
   */
  toSQL(): string {
    if (!this.referencedTable || !this.referencedColumn) {
      throw new Error("Foreign key must reference a table and column");
    }

    let sql = `FOREIGN KEY (${this.column}) REFERENCES ${this.referencedTable}(${this.referencedColumn})`;

    if (this.onDeleteAction) {
      sql += ` ON DELETE ${this.onDeleteAction}`;
    }
    if (this.onUpdateAction) {
      sql += ` ON UPDATE ${this.onUpdateAction}`;
    }

    return sql;
  }
}

/**
 * Blueprint - defines table structure
 * Arcanox's Schema Blueprint
 */
export class Blueprint {
  private tableName: string;
  private columns: ColumnDefinition[] = [];
  private indexes: Array<{
    columns: string[];
    unique: boolean;
    name?: string;
  }> = [];
  private foreignKeys: ForeignKeyBuilder[] = [];
  private primaryKeys: string[] = [];

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Add auto-incrementing ID column
   */
  id(name: string = "id"): ColumnBuilder {
    const col = new ColumnBuilder(name, "bigInteger");
    col.primary().autoIncrement().unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add UUID column
   */
  uuid(name: string = "id"): ColumnBuilder {
    const col = new ColumnBuilder(name, "uuid");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add ObjectId column (MongoDB specific)
   */
  objectId(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "objectId");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add string column
   */
  string(name: string, length: number = 255): ColumnBuilder {
    const col = new ColumnBuilder(name, "string", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add text column
   */
  text(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "text");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add integer column
   */
  integer(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "integer");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add big integer column
   */
  bigInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "bigInteger");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add decimal column
   */
  decimal(
    name: string,
    precision: number = 10,
    scale: number = 2
  ): ColumnBuilder {
    const col = new ColumnBuilder(name, "decimal");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add float column
   */
  float(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "float");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add double column
   */
  double(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "double");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add boolean column
   */
  boolean(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "boolean");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add date column
   */
  date(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "date");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add datetime column
   */
  datetime(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "datetime");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add timestamp column
   */
  timestamp(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "timestamp");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add created_at and updated_at timestamps
   */
  timestamps(): void {
    this.timestamp("created_at").nullable();
    this.timestamp("updated_at").nullable();
  }

  /**
   * Add deleted_at timestamp for soft deletes
   */
  softDeletes(name: string = "deleted_at"): ColumnBuilder {
    return this.timestamp(name).nullable();
  }

  /**
   * Add JSON column
   */
  json(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "json");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add enum column
   */
  enum(name: string, values: string[]): ColumnBuilder {
    const col = new ColumnBuilder(name, "enum");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add foreign key constraint
   */
  foreign(column: string): ForeignKeyBuilder {
    const fk = new ForeignKeyBuilder(column);
    this.foreignKeys.push(fk);
    return fk;
  }

  /**
   * Add index
   */
  index(columns: string | string[], name?: string): void {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name });
  }

  /**
   * Add unique index
   */
  unique(columns: string | string[], name?: string): void {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: true, name });
  }

  /**
   * Set primary key
   */
  primary(columns: string | string[]): void {
    this.primaryKeys = Array.isArray(columns) ? columns : [columns];
  }

  /**
   * Get all columns
   */
  getColumns(): ColumnDefinition[] {
    return this.columns;
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Get indexes
   */
  getIndexes() {
    return this.indexes;
  }

  /**
   * Get foreign keys
   */
  getForeignKeys() {
    return this.foreignKeys;
  }
}
