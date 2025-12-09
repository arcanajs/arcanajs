import crypto from "crypto";
import * as ejs from "ejs";
import * as fs from "fs";
import { htmlToText as convertHtmlToText } from "html-to-text";
import * as path from "path";
import { MailTemplateConfig } from "../types";

/**
 * Cache entry for compiled templates
 */
interface CacheEntry {
  compiled: ejs.TemplateFunction | ((data: any) => string);
  mtime: number;
  hits: number;
}

/**
 * Template render options
 */
interface RenderOptions {
  layout?: string | false;
  cache?: boolean;
  minify?: boolean;
  data?: Record<string, any>;
}

/**
 * Global helpers type
 */
type TemplateHelper = (...args: any[]) => any;

/**
 * Template renderer for email views
 * Features: caching, multiple engines, MJML support, minification, global helpers
 */
export class TemplateRenderer {
  private static config?: MailTemplateConfig;
  private static cache: Map<string, CacheEntry> = new Map();
  private static helpers: Map<string, TemplateHelper> = new Map();
  private static partials: Map<string, string> = new Map();

  /**
   * Initialize the template renderer
   */
  static init(config: MailTemplateConfig): void {
    this.config = config;

    // Pre-register default helpers
    this.registerDefaultHelpers();

    // Load partials if configured
    if (config.partialsPath) {
      this.loadPartials(config.partialsPath);
    }
  }

  /**
   * Register default template helpers
   */
  private static registerDefaultHelpers(): void {
    // Date formatting
    this.registerHelper("formatDate", (date: Date, format?: string) => {
      if (!date) return "";
      const d = new Date(date);
      if (format === "short") {
        return d.toLocaleDateString();
      } else if (format === "long") {
        return d.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } else if (format === "time") {
        return d.toLocaleTimeString();
      }
      return d.toISOString();
    });

    // Number formatting
    this.registerHelper("formatNumber", (num: number, decimals?: number) => {
      if (typeof num !== "number") return num;
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    });

    // Currency formatting
    this.registerHelper(
      "formatCurrency",
      (amount: number, currency?: string) => {
        if (typeof amount !== "number") return amount;
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currency || "USD",
        }).format(amount);
      }
    );

    // Truncate text
    this.registerHelper(
      "truncate",
      (text: string, length: number, suffix?: string) => {
        if (!text || text.length <= length) return text;
        return text.substring(0, length) + (suffix || "...");
      }
    );

    // Capitalize
    this.registerHelper("capitalize", (text: string) => {
      if (!text) return text;
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    });

    // JSON stringify
    this.registerHelper("json", (obj: any) => JSON.stringify(obj));

    // Conditional classes
    this.registerHelper("classNames", (...args: any[]) => {
      return args
        .filter(
          (arg) => typeof arg === "string" || (typeof arg === "object" && arg)
        )
        .map((arg) => {
          if (typeof arg === "string") return arg;
          return Object.entries(arg)
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(" ");
        })
        .join(" ");
    });

    // Safe URL encoding
    this.registerHelper("encodeURI", (url: string) =>
      encodeURIComponent(url || "")
    );

    // Asset URL helper
    this.registerHelper("asset", (assetPath: string) => {
      const baseUrl = this.config?.assetsUrl || "";
      return `${baseUrl}/${assetPath}`.replace(/\/+/g, "/");
    });
  }

  /**
   * Register a custom helper
   */
  static registerHelper(name: string, fn: TemplateHelper): void {
    this.helpers.set(name, fn);
  }

  /**
   * Unregister a helper
   */
  static unregisterHelper(name: string): void {
    this.helpers.delete(name);
  }

  /**
   * Load partials from directory
   */
  private static loadPartials(partialsPath: string): void {
    const fullPath = path.join(process.cwd(), partialsPath);

    if (!fs.existsSync(fullPath)) return;

    const files = fs.readdirSync(fullPath);
    for (const file of files) {
      const ext = path.extname(file);
      if ([".ejs", ".hbs", ".html"].includes(ext)) {
        const name = path.basename(file, ext);
        const content = fs.readFileSync(path.join(fullPath, file), "utf-8");
        this.partials.set(name, content);
      }
    }
  }

  /**
   * Register a partial
   */
  static registerPartial(name: string, content: string): void {
    this.partials.set(name, content);
  }

  /**
   * Render a template to HTML
   */
  static async render(
    templateName: string,
    data: Record<string, any> = {},
    options?: RenderOptions
  ): Promise<{ html: string; text: string }> {
    if (!this.config) {
      throw new TemplateError(
        "TemplateRenderer not initialized",
        "NOT_INITIALIZED"
      );
    }

    const templatePath = this.resolveTemplatePath(templateName);

    if (!fs.existsSync(templatePath)) {
      throw new TemplateError(
        `Template not found: ${templatePath}`,
        "NOT_FOUND"
      );
    }

    // Merge data with helpers
    const renderData = this.prepareRenderData(data);

    let html: string;
    const shouldCache = options?.cache ?? this.config.cache ?? true;

    // Check cache
    if (shouldCache) {
      const cached = this.getFromCache(templatePath);
      if (cached) {
        html = cached(renderData);
      } else {
        html = await this.renderTemplate(templatePath, renderData);
      }
    } else {
      html = await this.renderTemplate(templatePath, renderData);
    }

    // Apply layout if configured
    const layoutName =
      options?.layout !== false
        ? options?.layout || this.config.defaultLayout
        : undefined;

    if (layoutName && this.config.layoutsPath) {
      html = await this.applyLayout(html, renderData, layoutName);
    }

    // Process inline styles if configured
    if (this.config.inlineCss) {
      html = await this.inlineCss(html);
    }

    // Minify if configured
    if (options?.minify ?? this.config.minify) {
      html = this.minifyHtml(html);
    }

    // Generate plain text version
    const text = this.htmlToText(html);

    return { html, text };
  }

  /**
   * Resolve template path based on configuration
   */
  private static resolveTemplatePath(templateName: string): string {
    const ext = this.getTemplateExtension();

    // Check if template name already has extension
    if (templateName.endsWith(`.${ext}`)) {
      return path.join(process.cwd(), this.config!.viewsPath, templateName);
    }

    return path.join(
      process.cwd(),
      this.config!.viewsPath,
      `${templateName}.${ext}`
    );
  }

  /**
   * Get template file extension
   */
  private static getTemplateExtension(): string {
    switch (this.config?.engine) {
      case "handlebars":
        return "hbs";
      case "mjml":
        return "mjml";
      default:
        return "ejs";
    }
  }

  /**
   * Prepare render data with helpers
   */
  private static prepareRenderData(
    data: Record<string, any>
  ): Record<string, any> {
    const helpers: Record<string, TemplateHelper> = {};
    this.helpers.forEach((fn, name) => {
      helpers[name] = fn;
    });

    return {
      ...data,
      ...helpers,
      partials: Object.fromEntries(this.partials),
      __config: {
        assetsUrl: this.config?.assetsUrl,
      },
    };
  }

  /**
   * Render template based on engine
   */
  private static async renderTemplate(
    templatePath: string,
    data: Record<string, any>
  ): Promise<string> {
    const engine = this.config?.engine || "ejs";

    switch (engine) {
      case "ejs":
        return this.renderEJS(templatePath, data);
      case "handlebars":
        return this.renderHandlebars(templatePath, data);
      case "mjml":
        return this.renderMJML(templatePath, data);
      default:
        throw new TemplateError(
          `Unsupported template engine: ${engine}`,
          "UNSUPPORTED_ENGINE"
        );
    }
  }

  /**
   * Get compiled template from cache
   */
  private static getFromCache(
    templatePath: string
  ): ((data: any) => string) | null {
    const cached = this.cache.get(templatePath);
    if (!cached) return null;

    // Check if file was modified
    const stat = fs.statSync(templatePath);
    if (stat.mtimeMs > cached.mtime) {
      this.cache.delete(templatePath);
      return null;
    }

    cached.hits++;
    return cached.compiled as (data: any) => string;
  }

  /**
   * Add compiled template to cache
   */
  private static addToCache(
    templatePath: string,
    compiled: ejs.TemplateFunction | ((data: any) => string)
  ): void {
    const stat = fs.statSync(templatePath);

    // Limit cache size
    if (this.cache.size >= 100) {
      // Remove least used entries
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].hits - b[1].hits
      );

      for (let i = 0; i < 20; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(templatePath, {
      compiled,
      mtime: stat.mtimeMs,
      hits: 0,
    });
  }

  /**
   * Render EJS template
   */
  private static async renderEJS(
    templatePath: string,
    data: Record<string, any>
  ): Promise<string> {
    const shouldCache = this.config?.cache ?? true;

    if (shouldCache) {
      const template = fs.readFileSync(templatePath, "utf-8");
      const compiled = ejs.compile(template, {
        filename: templatePath,
        cache: false, // We handle caching ourselves
      });

      this.addToCache(templatePath, compiled);
      return compiled(data);
    }

    return ejs.renderFile(templatePath, data);
  }

  /**
   * Render Handlebars template
   */
  private static async renderHandlebars(
    templatePath: string,
    data: Record<string, any>
  ): Promise<string> {
    const Handlebars = require("handlebars");
    const template = fs.readFileSync(templatePath, "utf-8");

    // Register partials
    this.partials.forEach((content, name) => {
      Handlebars.registerPartial(name, content);
    });

    // Register helpers
    this.helpers.forEach((fn, name) => {
      Handlebars.registerHelper(name, fn);
    });

    const compiled = Handlebars.compile(template);

    if (this.config?.cache) {
      this.addToCache(templatePath, compiled);
    }

    return compiled(data);
  }

  /**
   * Render MJML template (converts to HTML)
   */
  private static async renderMJML(
    templatePath: string,
    data: Record<string, any>
  ): Promise<string> {
    try {
      const mjml = require("mjml");

      // First render as EJS to handle data interpolation
      let mjmlContent = fs.readFileSync(templatePath, "utf-8");
      mjmlContent = ejs.render(mjmlContent, data);

      // Then compile MJML to HTML
      const result = mjml(mjmlContent, {
        filePath: templatePath,
        minify: this.config?.minify,
        validationLevel: "soft",
      });

      if (result.errors && result.errors.length > 0) {
        console.warn("MJML compilation warnings:", result.errors);
      }

      return result.html;
    } catch (error) {
      if ((error as any).code === "MODULE_NOT_FOUND") {
        throw new TemplateError(
          "MJML package not installed. Run: npm install mjml",
          "MISSING_DEPENDENCY"
        );
      }
      throw error;
    }
  }

  /**
   * Apply layout to rendered content
   */
  private static async applyLayout(
    content: string,
    data: Record<string, any>,
    layoutName: string
  ): Promise<string> {
    if (!this.config?.layoutsPath) {
      return content;
    }

    const ext = this.getTemplateExtension();
    const layoutPath = path.join(
      process.cwd(),
      this.config.layoutsPath,
      `${layoutName}.${ext}`
    );

    if (!fs.existsSync(layoutPath)) {
      console.warn(`Layout not found: ${layoutPath}, skipping layout`);
      return content;
    }

    const layoutData = { ...data, body: content, content };

    return this.renderTemplate(layoutPath, layoutData);
  }

  /**
   * Inline CSS styles into HTML elements
   */
  private static async inlineCss(html: string): Promise<string> {
    try {
      const juice = require("juice");
      return juice(html, {
        removeStyleTags: true,
        preserveMediaQueries: true,
        preserveFontFaces: true,
      });
    } catch (error) {
      if ((error as any).code === "MODULE_NOT_FOUND") {
        console.warn(
          "juice package not installed for CSS inlining. Run: npm install juice"
        );
        return html;
      }
      throw error;
    }
  }

  /**
   * Minify HTML
   */
  private static minifyHtml(html: string): string {
    return html
      .replace(/\n\s*\n/g, "\n")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /**
   * Convert HTML to plain text
   */
  private static htmlToText(html: string): string {
    return convertHtmlToText(html, {
      wordwrap: 80,
      selectors: [
        { selector: "img", format: "skip" },
        {
          selector: "a",
          options: { ignoreHref: false, linkBrackets: ["[", "]"] },
        },
        { selector: "h1", options: { uppercase: true } },
        { selector: "h2", options: { uppercase: true } },
        { selector: "table", format: "dataTable" },
      ],
      preserveNewlines: true,
    }).trim();
  }

  /**
   * Clear template cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    entries: Array<{ path: string; hits: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([path, entry]) => ({
      path,
      hits: entry.hits,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Render a string template (not from file)
   */
  static async renderString(
    template: string,
    data: Record<string, any> = {},
    engine?: "ejs" | "handlebars"
  ): Promise<string> {
    const useEngine = engine || this.config?.engine || "ejs";
    const renderData = this.prepareRenderData(data);

    if (useEngine === "handlebars") {
      const Handlebars = require("handlebars");
      const compiled = Handlebars.compile(template);
      return compiled(renderData);
    }

    return ejs.render(template, renderData);
  }

  /**
   * Preview template without sending
   */
  static async preview(
    templateName: string,
    data: Record<string, any> = {}
  ): Promise<{ html: string; text: string; subject?: string }> {
    const result = await this.render(templateName, data);

    // Extract subject from HTML if present
    const subjectMatch = result.html.match(/<title>(.*?)<\/title>/i);

    return {
      ...result,
      subject: subjectMatch?.[1] || undefined,
    };
  }

  /**
   * Generate a content hash for caching
   */
  static generateHash(content: string): string {
    return crypto
      .createHash("md5")
      .update(content)
      .digest("hex")
      .substring(0, 8);
  }
}

/**
 * Template rendering error
 */
export class TemplateError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TemplateError";
    this.code = code;
  }
}
