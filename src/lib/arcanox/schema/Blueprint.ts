import type { ColumnDefinition, ColumnType } from "../types";

/**
 * Column modifier interface
 */
export interface ColumnModifier {
  nullable?: boolean;
  default?: any;
  unique?: boolean;
  primary?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  comment?: string;
  charset?: string;
  collation?: string;
  after?: string;
  first?: boolean;
  storedAs?: string;
  virtualAs?: string;
  generatedAs?: string;
  invisible?: boolean;
  useCurrent?: boolean;
  useCurrentOnUpdate?: boolean;
}

/**
 * Column definition builder - fluent interface for defining columns
 */
export class ColumnBuilder {
  private definition: ColumnDefinition;
  private modifiers: ColumnModifier = {};

  constructor(name: string, type: ColumnType, length?: number) {
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
  nullable(isNullable: boolean = true): this {
    this.definition.nullable = isNullable;
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
   * Add index to column
   */
  index(name?: string): this {
    this.definition.index = name || this.definition.name;
    return this;
  }

  /**
   * Add fulltext index
   */
  fulltext(name?: string): this {
    (this.definition as any).fulltext = name || this.definition.name;
    return this;
  }

  /**
   * Add spatial index
   */
  spatialIndex(name?: string): this {
    (this.definition as any).spatialIndex = name || this.definition.name;
    return this;
  }

  /**
   * Add column comment
   */
  comment(text: string): this {
    this.modifiers.comment = text;
    return this;
  }

  /**
   * Set character set
   */
  charset(charset: string): this {
    this.modifiers.charset = charset;
    return this;
  }

  /**
   * Set collation
   */
  collation(collation: string): this {
    this.modifiers.collation = collation;
    return this;
  }

  /**
   * Place column after another column
   */
  after(column: string): this {
    this.modifiers.after = column;
    return this;
  }

  /**
   * Place column at the beginning of the table
   */
  first(): this {
    this.modifiers.first = true;
    return this;
  }

  /**
   * Create a stored generated column (MySQL/PostgreSQL)
   */
  storedAs(expression: string): this {
    this.modifiers.storedAs = expression;
    return this;
  }

  /**
   * Create a virtual generated column (MySQL)
   */
  virtualAs(expression: string): this {
    this.modifiers.virtualAs = expression;
    return this;
  }

  /**
   * Create a generated column (PostgreSQL)
   */
  generatedAs(expression: string): this {
    this.modifiers.generatedAs = expression;
    return this;
  }

  /**
   * Make column invisible (MySQL 8.0+)
   */
  invisible(): this {
    this.modifiers.invisible = true;
    return this;
  }

  /**
   * Set timestamp column to use current timestamp as default
   */
  useCurrent(): this {
    this.modifiers.useCurrent = true;
    return this;
  }

  /**
   * Set timestamp column to update on record update
   */
  useCurrentOnUpdate(): this {
    this.modifiers.useCurrentOnUpdate = true;
    return this;
  }

  /**
   * Specify a "change" - modify existing column
   */
  change(): this {
    (this.definition as any).change = true;
    return this;
  }

  /**
   * Mark column for rename
   */
  renameTo(newName: string): this {
    (this.definition as any).renameTo = newName;
    return this;
  }

  /**
   * Get the column definition
   */
  getDefinition(): ColumnDefinition & ColumnModifier {
    return { ...this.definition, ...this.modifiers };
  }
}

/**
 * Foreign key definition builder
 */
export class ForeignKeyBuilder {
  private columns: string[];
  private referencedTable?: string;
  private referencedColumns?: string[];
  private onDeleteAction?: string;
  private onUpdateAction?: string;
  private constraintName?: string;
  private _deferrable: boolean = false;
  private _initiallyDeferred: boolean = false;

  constructor(columns: string | string[]) {
    this.columns = Array.isArray(columns) ? columns : [columns];
  }

  /**
   * Set referenced column(s)
   */
  references(columns: string | string[]): this {
    this.referencedColumns = Array.isArray(columns) ? columns : [columns];
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
  onDelete(
    action: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION"
  ): this {
    this.onDeleteAction = action;
    return this;
  }

  /**
   * Set ON UPDATE action
   */
  onUpdate(
    action: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION"
  ): this {
    this.onUpdateAction = action;
    return this;
  }

  /**
   * Cascade on delete
   */
  cascadeOnDelete(): this {
    return this.onDelete("CASCADE");
  }

  /**
   * Cascade on update
   */
  cascadeOnUpdate(): this {
    return this.onUpdate("CASCADE");
  }

  /**
   * Set null on delete
   */
  nullOnDelete(): this {
    return this.onDelete("SET NULL");
  }

  /**
   * Restrict on delete
   */
  restrictOnDelete(): this {
    return this.onDelete("RESTRICT");
  }

  /**
   * No action on delete
   */
  noActionOnDelete(): this {
    return this.onDelete("NO ACTION");
  }

  /**
   * Set constraint name
   */
  name(constraintName: string): this {
    this.constraintName = constraintName;
    return this;
  }

  /**
   * Make constraint deferrable (PostgreSQL)
   */
  deferrable(initially: "DEFERRED" | "IMMEDIATE" = "IMMEDIATE"): this {
    this._deferrable = true;
    this._initiallyDeferred = initially === "DEFERRED";
    return this;
  }

  /**
   * Get foreign key SQL
   */
  toSQL(): string {
    if (!this.referencedTable || !this.referencedColumns?.length) {
      throw new Error("Foreign key must reference a table and column(s)");
    }

    let sql = "";

    if (this.constraintName) {
      sql += `CONSTRAINT ${this.constraintName} `;
    }

    sql += `FOREIGN KEY (${this.columns.join(", ")}) REFERENCES ${
      this.referencedTable
    }(${this.referencedColumns.join(", ")})`;

    if (this.onDeleteAction) {
      sql += ` ON DELETE ${this.onDeleteAction}`;
    }
    if (this.onUpdateAction) {
      sql += ` ON UPDATE ${this.onUpdateAction}`;
    }

    if (this._deferrable) {
      sql += " DEFERRABLE";
      sql += this._initiallyDeferred
        ? " INITIALLY DEFERRED"
        : " INITIALLY IMMEDIATE";
    }

    return sql;
  }

  /**
   * Get the foreign key definition as object
   */
  getDefinition() {
    return {
      columns: this.columns,
      referencedTable: this.referencedTable,
      referencedColumns: this.referencedColumns,
      onDelete: this.onDeleteAction,
      onUpdate: this.onUpdateAction,
      name: this.constraintName,
      deferrable: this._deferrable,
      initiallyDeferred: this._initiallyDeferred,
    };
  }
}

/**
 * Check constraint builder
 */
export class CheckConstraintBuilder {
  private expression: string;
  private constraintName?: string;

  constructor(expression: string) {
    this.expression = expression;
  }

  /**
   * Set constraint name
   */
  name(constraintName: string): this {
    this.constraintName = constraintName;
    return this;
  }

  /**
   * Get check constraint SQL
   */
  toSQL(): string {
    let sql = "";
    if (this.constraintName) {
      sql += `CONSTRAINT ${this.constraintName} `;
    }
    sql += `CHECK (${this.expression})`;
    return sql;
  }

  getDefinition() {
    return {
      expression: this.expression,
      name: this.constraintName,
    };
  }
}

/**
 * Index definition
 */
export interface IndexDefinition {
  columns: string[];
  unique: boolean;
  name?: string;
  type?:
    | "btree"
    | "hash"
    | "gin"
    | "gist"
    | "spgist"
    | "brin"
    | "fulltext"
    | "spatial";
  where?: string;
  include?: string[];
  nullsNotDistinct?: boolean;
}

/**
 * Blueprint - defines table structure
 * Arcanox's Professional Schema Blueprint
 */
export class Blueprint {
  private tableName: string;
  private columns: (ColumnDefinition & ColumnModifier)[] = [];
  private indexes: IndexDefinition[] = [];
  private foreignKeys: ForeignKeyBuilder[] = [];
  private checkConstraints: CheckConstraintBuilder[] = [];
  private primaryKeys: string[] = [];
  private dropColumns: string[] = [];
  private renameColumns: Array<{ from: string; to: string }> = [];
  private dropIndexes: string[] = [];
  private dropForeignKeys: string[] = [];
  private _engine?: string;
  private _charset?: string;
  private _collation?: string;
  private tableComment?: string;
  private _temporary: boolean = false;
  private _ifNotExists: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  // ===========================================================================
  // ID & Key Columns
  // ===========================================================================

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
   * Add auto-incrementing tiny integer ID column
   */
  tinyIncrements(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tinyInteger");
    col.primary().autoIncrement().unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add auto-incrementing small integer ID column
   */
  smallIncrements(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "smallInteger");
    col.primary().autoIncrement().unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add auto-incrementing medium integer ID column
   */
  mediumIncrements(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "mediumInteger");
    col.primary().autoIncrement().unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add auto-incrementing integer ID column
   */
  increments(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "integer");
    col.primary().autoIncrement().unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add auto-incrementing big integer ID column
   */
  bigIncrements(name: string): ColumnBuilder {
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
   * Add UUID primary key column with auto-generation
   */
  uuidPrimary(name: string = "id"): ColumnBuilder {
    const col = new ColumnBuilder(name, "uuid");
    col.primary().default("gen_random_uuid()");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add ULID column
   */
  ulid(name: string = "id", length: number = 26): ColumnBuilder {
    const col = new ColumnBuilder(name, "char", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add ObjectId column (MongoDB specific)
   */
  objectId(name: string = "_id"): ColumnBuilder {
    const col = new ColumnBuilder(name, "objectId");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // String Columns
  // ===========================================================================

  /**
   * Add char column with fixed length
   */
  char(name: string, length: number = 255): ColumnBuilder {
    const col = new ColumnBuilder(name, "char", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add string/varchar column
   */
  string(name: string, length: number = 255): ColumnBuilder {
    const col = new ColumnBuilder(name, "string", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add tiny text column (~255 bytes)
   */
  tinyText(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tinyText");
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
   * Add medium text column (~16MB)
   */
  mediumText(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "mediumText");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add long text column (~4GB)
   */
  longText(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "longText");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Numeric Columns
  // ===========================================================================

  /**
   * Add tiny integer column
   */
  tinyInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tinyInteger");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add unsigned tiny integer column
   */
  unsignedTinyInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tinyInteger");
    col.unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add small integer column
   */
  smallInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "smallInteger");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add unsigned small integer column
   */
  unsignedSmallInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "smallInteger");
    col.unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add medium integer column
   */
  mediumInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "mediumInteger");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add unsigned medium integer column
   */
  unsignedMediumInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "mediumInteger");
    col.unsigned();
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
   * Add unsigned integer column
   */
  unsignedInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "integer");
    col.unsigned();
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
   * Add unsigned big integer column
   */
  unsignedBigInteger(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "bigInteger");
    col.unsigned();
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
    (col.getDefinition() as any).precision = precision;
    (col.getDefinition() as any).scale = scale;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add unsigned decimal column
   */
  unsignedDecimal(
    name: string,
    precision: number = 10,
    scale: number = 2
  ): ColumnBuilder {
    const col = new ColumnBuilder(name, "decimal");
    (col.getDefinition() as any).precision = precision;
    (col.getDefinition() as any).scale = scale;
    col.unsigned();
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add float column
   */
  float(name: string, precision?: number, scale?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "float");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    if (scale !== undefined) (col.getDefinition() as any).scale = scale;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add unsigned float column
   */
  unsignedFloat(
    name: string,
    precision?: number,
    scale?: number
  ): ColumnBuilder {
    const col = this.float(name, precision, scale);
    col.unsigned();
    return col;
  }

  /**
   * Add double column
   */
  double(name: string, precision?: number, scale?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "double");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    if (scale !== undefined) (col.getDefinition() as any).scale = scale;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add unsigned double column
   */
  unsignedDouble(
    name: string,
    precision?: number,
    scale?: number
  ): ColumnBuilder {
    const col = this.double(name, precision, scale);
    col.unsigned();
    return col;
  }

  /**
   * Add real column (PostgreSQL)
   */
  real(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "real");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add numeric column (alias for decimal)
   */
  numeric(
    name: string,
    precision: number = 10,
    scale: number = 2
  ): ColumnBuilder {
    return this.decimal(name, precision, scale);
  }

  /**
   * Add money column (PostgreSQL)
   */
  money(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "money");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Boolean Column
  // ===========================================================================

  /**
   * Add boolean column
   */
  boolean(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "boolean");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Date and Time Columns
  // ===========================================================================

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
  datetime(name: string, precision?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "datetime");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add datetime column with timezone
   */
  datetimeTz(name: string, precision?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "datetimeTz");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add time column
   */
  time(name: string, precision?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "time");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add time column with timezone
   */
  timeTz(name: string, precision?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "timeTz");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add timestamp column
   */
  timestamp(name: string, precision?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "timestamp");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add timestamp column with timezone
   */
  timestampTz(name: string, precision?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "timestampTz");
    if (precision !== undefined)
      (col.getDefinition() as any).precision = precision;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add created_at and updated_at timestamps
   */
  timestamps(precision?: number): void {
    this.timestamp("created_at", precision).nullable().useCurrent();
    this.timestamp("updated_at", precision)
      .nullable()
      .useCurrent()
      .useCurrentOnUpdate();
  }

  /**
   * Add created_at and updated_at timestamps with timezone
   */
  timestampsTz(precision?: number): void {
    this.timestampTz("created_at", precision).nullable().useCurrent();
    this.timestampTz("updated_at", precision)
      .nullable()
      .useCurrent()
      .useCurrentOnUpdate();
  }

  /**
   * Add deleted_at timestamp for soft deletes
   */
  softDeletes(name: string = "deleted_at", precision?: number): ColumnBuilder {
    return this.timestamp(name, precision).nullable();
  }

  /**
   * Add deleted_at timestamp with timezone for soft deletes
   */
  softDeletesTz(
    name: string = "deleted_at",
    precision?: number
  ): ColumnBuilder {
    return this.timestampTz(name, precision).nullable();
  }

  /**
   * Add year column
   */
  year(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "year");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add interval column (PostgreSQL)
   */
  interval(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "interval");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Binary Columns
  // ===========================================================================

  /**
   * Add binary column
   */
  binary(name: string, length?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "binary", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add blob column
   */
  blob(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "blob");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add tiny blob column
   */
  tinyBlob(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tinyBlob");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add medium blob column
   */
  mediumBlob(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "mediumBlob");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add long blob column
   */
  longBlob(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "longBlob");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add bytea column (PostgreSQL)
   */
  bytea(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "bytea");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // JSON Columns
  // ===========================================================================

  /**
   * Add JSON column
   */
  json(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "json");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add JSONB column (PostgreSQL)
   */
  jsonb(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "jsonb");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Enum and Set Columns
  // ===========================================================================

  /**
   * Add enum column
   */
  enum(name: string, values: string[]): ColumnBuilder {
    const col = new ColumnBuilder(name, "enum");
    (col.getDefinition() as any).values = values;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add set column (MySQL)
   */
  set(name: string, values: string[]): ColumnBuilder {
    const col = new ColumnBuilder(name, "set");
    (col.getDefinition() as any).values = values;
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Spatial Columns (PostGIS / MySQL)
  // ===========================================================================

  /**
   * Add geometry column
   */
  geometry(name: string, subtype?: string, srid?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "geometry");
    if (subtype) (col.getDefinition() as any).subtype = subtype;
    if (srid) (col.getDefinition() as any).srid = srid;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add geography column (PostGIS)
   */
  geography(
    name: string,
    subtype?: string,
    srid: number = 4326
  ): ColumnBuilder {
    const col = new ColumnBuilder(name, "geography");
    if (subtype) (col.getDefinition() as any).subtype = subtype;
    (col.getDefinition() as any).srid = srid;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add point column
   */
  point(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "POINT", srid);
  }

  /**
   * Add line string column
   */
  lineString(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "LINESTRING", srid);
  }

  /**
   * Add polygon column
   */
  polygon(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "POLYGON", srid);
  }

  /**
   * Add multi point column
   */
  multiPoint(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "MULTIPOINT", srid);
  }

  /**
   * Add multi line string column
   */
  multiLineString(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "MULTILINESTRING", srid);
  }

  /**
   * Add multi polygon column
   */
  multiPolygon(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "MULTIPOLYGON", srid);
  }

  /**
   * Add geometry collection column
   */
  geometryCollection(name: string, srid?: number): ColumnBuilder {
    return this.geometry(name, "GEOMETRYCOLLECTION", srid);
  }

  // ===========================================================================
  // PostgreSQL Array and Range Types
  // ===========================================================================

  /**
   * Add array column (PostgreSQL)
   */
  array(name: string, elementType: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "array");
    (col.getDefinition() as any).elementType = elementType;
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add integer range column (PostgreSQL)
   */
  integerRange(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "int4range");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add bigint range column (PostgreSQL)
   */
  bigIntegerRange(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "int8range");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add numeric range column (PostgreSQL)
   */
  numericRange(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "numrange");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add timestamp range column (PostgreSQL)
   */
  timestampRange(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tsrange");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add timestamp with timezone range column (PostgreSQL)
   */
  timestampTzRange(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tstzrange");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add date range column (PostgreSQL)
   */
  dateRange(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "daterange");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Network Types (PostgreSQL)
  // ===========================================================================

  /**
   * Add IP address column (PostgreSQL inet)
   */
  ipAddress(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "inet");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add MAC address column (PostgreSQL macaddr)
   */
  macAddress(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "macaddr");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add MAC address (EUI-64) column (PostgreSQL macaddr8)
   */
  macAddress8(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "macaddr8");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add CIDR column (PostgreSQL)
   */
  cidr(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "cidr");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Full-Text Search Types (PostgreSQL)
  // ===========================================================================

  /**
   * Add tsvector column for full-text search (PostgreSQL)
   */
  tsvector(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tsvector");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add tsquery column for full-text search (PostgreSQL)
   */
  tsquery(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "tsquery");
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Other Types
  // ===========================================================================

  /**
   * Add bit column
   */
  bit(name: string, length: number = 1): ColumnBuilder {
    const col = new ColumnBuilder(name, "bit", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add varbit column (PostgreSQL)
   */
  varbit(name: string, length?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, "varbit", length);
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add XML column (PostgreSQL)
   */
  xml(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "xml");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add hstore column (PostgreSQL key-value)
   */
  hstore(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "hstore");
    this.columns.push(col.getDefinition());
    return col;
  }

  /**
   * Add computed/generated column
   */
  computed(
    name: string,
    expression: string,
    stored: boolean = false
  ): ColumnBuilder {
    const col = new ColumnBuilder(name, "computed");
    if (stored) {
      col.storedAs(expression);
    } else {
      col.virtualAs(expression);
    }
    this.columns.push(col.getDefinition());
    return col;
  }

  // ===========================================================================
  // Relationship Helper Columns
  // ===========================================================================

  /**
   * Add foreign ID column (creates unsigned big integer)
   */
  foreignId(name: string): ColumnBuilder {
    return this.unsignedBigInteger(name);
  }

  /**
   * Add foreign ID column for a model (creates column and foreign key)
   */
  foreignIdFor(
    model: string | { tableName: string },
    column?: string
  ): ColumnBuilder {
    const tableName = typeof model === "string" ? model : model.tableName;
    const columnName = column || `${tableName.replace(/s$/, "")}_id`;
    const col = this.unsignedBigInteger(columnName);
    this.foreign(columnName).references("id").on(tableName);
    return col;
  }

  /**
   * Add nullable foreign ID for a model
   */
  nullableForeignIdFor(
    model: string | { tableName: string },
    column?: string
  ): ColumnBuilder {
    const tableName = typeof model === "string" ? model : model.tableName;
    const columnName = column || `${tableName.replace(/s$/, "")}_id`;
    const col = this.unsignedBigInteger(columnName).nullable();
    this.foreign(columnName).references("id").on(tableName).nullOnDelete();
    return col;
  }

  /**
   * Add foreign UUID column
   */
  foreignUuid(name: string): ColumnBuilder {
    return this.uuid(name);
  }

  /**
   * Add foreign ULID column
   */
  foreignUlid(name: string): ColumnBuilder {
    return this.ulid(name);
  }

  /**
   * Add morphs columns for polymorphic relationships
   */
  morphs(name: string, indexName?: string): void {
    this.string(`${name}_type`);
    this.unsignedBigInteger(`${name}_id`);
    this.index([`${name}_type`, `${name}_id`], indexName || `${name}_index`);
  }

  /**
   * Add nullable morphs columns
   */
  nullableMorphs(name: string, indexName?: string): void {
    this.string(`${name}_type`).nullable();
    this.unsignedBigInteger(`${name}_id`).nullable();
    this.index([`${name}_type`, `${name}_id`], indexName || `${name}_index`);
  }

  /**
   * Add UUID morphs columns
   */
  uuidMorphs(name: string, indexName?: string): void {
    this.string(`${name}_type`);
    this.uuid(`${name}_id`);
    this.index([`${name}_type`, `${name}_id`], indexName || `${name}_index`);
  }

  /**
   * Add nullable UUID morphs columns
   */
  nullableUuidMorphs(name: string, indexName?: string): void {
    this.string(`${name}_type`).nullable();
    this.uuid(`${name}_id`).nullable();
    this.index([`${name}_type`, `${name}_id`], indexName || `${name}_index`);
  }

  /**
   * Add ULID morphs columns
   */
  ulidMorphs(name: string, indexName?: string): void {
    this.string(`${name}_type`);
    this.ulid(`${name}_id`);
    this.index([`${name}_type`, `${name}_id`], indexName || `${name}_index`);
  }

  /**
   * Add remember_me token column
   */
  rememberToken(): ColumnBuilder {
    return this.string("remember_token", 100).nullable();
  }

  // ===========================================================================
  // Indexes
  // ===========================================================================

  /**
   * Add index
   */
  index(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name });
    return this;
  }

  /**
   * Add unique index
   */
  unique(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: true, name });
    return this;
  }

  /**
   * Add spatial index
   */
  spatialIndex(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, type: "spatial" });
    return this;
  }

  /**
   * Add fulltext index
   */
  fullText(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, type: "fulltext" });
    return this;
  }

  /**
   * Add GIN index (PostgreSQL)
   */
  gin(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, type: "gin" });
    return this;
  }

  /**
   * Add GiST index (PostgreSQL)
   */
  gist(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, type: "gist" });
    return this;
  }

  /**
   * Add BRIN index (PostgreSQL)
   */
  brin(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, type: "brin" });
    return this;
  }

  /**
   * Add hash index (PostgreSQL)
   */
  hash(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, type: "hash" });
    return this;
  }

  /**
   * Add partial index with WHERE clause
   */
  indexWhere(columns: string | string[], where: string, name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: false, name, where });
    return this;
  }

  /**
   * Add unique partial index with WHERE clause
   */
  uniqueWhere(columns: string | string[], where: string, name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.indexes.push({ columns: cols, unique: true, name, where });
    return this;
  }

  /**
   * Set primary key
   */
  primary(columns: string | string[]): this {
    this.primaryKeys = Array.isArray(columns) ? columns : [columns];
    return this;
  }

  /**
   * Drop index
   */
  dropIndex(name: string | string[]): this {
    const names = Array.isArray(name) ? name : [name];
    this.dropIndexes.push(...names);
    return this;
  }

  /**
   * Drop unique index
   */
  dropUnique(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    const name = `${this.tableName}_${cols.join("_")}_unique`;
    this.dropIndexes.push(name);
    return this;
  }

  // ===========================================================================
  // Foreign Keys & Constraints
  // ===========================================================================

  /**
   * Add foreign key constraint
   */
  foreign(columns: string | string[]): ForeignKeyBuilder {
    const fk = new ForeignKeyBuilder(columns);
    this.foreignKeys.push(fk);
    return fk;
  }

  /**
   * Drop foreign key constraint
   */
  dropForeign(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    const name = `${this.tableName}_${cols.join("_")}_foreign`;
    this.dropForeignKeys.push(name);
    return this;
  }

  /**
   * Drop foreign key by name
   */
  dropForeignByName(name: string): this {
    this.dropForeignKeys.push(name);
    return this;
  }

  /**
   * Add check constraint
   */
  check(expression: string, name?: string): CheckConstraintBuilder {
    const constraint = new CheckConstraintBuilder(expression);
    if (name) constraint.name(name);
    this.checkConstraints.push(constraint);
    return constraint;
  }

  // ===========================================================================
  // Column Modifications
  // ===========================================================================

  /**
   * Drop a column
   */
  dropColumn(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.dropColumns.push(...cols);
    return this;
  }

  /**
   * Rename a column
   */
  renameColumn(from: string, to: string): this {
    this.renameColumns.push({ from, to });
    return this;
  }

  /**
   * Drop timestamps columns
   */
  dropTimestamps(): this {
    return this.dropColumn(["created_at", "updated_at"]);
  }

  /**
   * Drop soft deletes column
   */
  dropSoftDeletes(column: string = "deleted_at"): this {
    return this.dropColumn(column);
  }

  /**
   * Drop remember token column
   */
  dropRememberToken(): this {
    return this.dropColumn("remember_token");
  }

  /**
   * Drop morphs columns
   */
  dropMorphs(name: string): this {
    return this.dropColumn([`${name}_type`, `${name}_id`]);
  }

  // ===========================================================================
  // Table Options
  // ===========================================================================

  /**
   * Set table engine (MySQL)
   */
  engine(engine: string): this {
    this._engine = engine;
    return this;
  }

  /**
   * Set table charset (MySQL)
   */
  charset(charset: string): this {
    this._charset = charset;
    return this;
  }

  /**
   * Set table collation (MySQL)
   */
  collation(collation: string): this {
    this._collation = collation;
    return this;
  }

  /**
   * Add table comment
   */
  comment(comment: string): this {
    this.tableComment = comment;
    return this;
  }

  /**
   * Make table temporary
   */
  temporary(): this {
    this._temporary = true;
    return this;
  }

  /**
   * Create table only if not exists
   */
  ifNotExists(): this {
    this._ifNotExists = true;
    return this;
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * Get all columns
   */
  getColumns(): (ColumnDefinition & ColumnModifier)[] {
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
  getIndexes(): IndexDefinition[] {
    return this.indexes;
  }

  /**
   * Get foreign keys
   */
  getForeignKeys(): ForeignKeyBuilder[] {
    return this.foreignKeys;
  }

  /**
   * Get check constraints
   */
  getCheckConstraints(): CheckConstraintBuilder[] {
    return this.checkConstraints;
  }

  /**
   * Get primary keys
   */
  getPrimaryKeys(): string[] {
    return this.primaryKeys;
  }

  /**
   * Get columns to drop
   */
  getDropColumns(): string[] {
    return this.dropColumns;
  }

  /**
   * Get columns to rename
   */
  getRenameColumns(): Array<{ from: string; to: string }> {
    return this.renameColumns;
  }

  /**
   * Get indexes to drop
   */
  getDropIndexes(): string[] {
    return this.dropIndexes;
  }

  /**
   * Get foreign keys to drop
   */
  getDropForeignKeys(): string[] {
    return this.dropForeignKeys;
  }

  /**
   * Get table options
   */
  getTableOptions() {
    return {
      engine: this._engine,
      charset: this._charset,
      collation: this._collation,
      comment: this.tableComment,
      temporary: this._temporary,
      ifNotExists: this._ifNotExists,
    };
  }
}
