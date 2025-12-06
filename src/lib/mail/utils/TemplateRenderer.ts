import * as ejs from "ejs";
import * as fs from "fs";
import { htmlToText as convertHtmlToText } from "html-to-text";
import * as path from "path";
import { MailTemplateConfig } from "../types";

/**
 * Template renderer for email views
 */
export class TemplateRenderer {
  private static config?: MailTemplateConfig;

  /**
   * Initialize the template renderer
   */
  static init(config: MailTemplateConfig) {
    this.config = config;
  }

  /**
   * Render a template to HTML
   */
  static async render(
    templateName: string,
    data: Record<string, any> = {}
  ): Promise<{ html: string; text: string }> {
    if (!this.config) {
      throw new Error("TemplateRenderer not initialized");
    }

    const templatePath = path.join(
      process.cwd(),
      this.config.viewsPath,
      `${templateName}.${this.config.engine === "ejs" ? "ejs" : "hbs"}`
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    let html: string;

    if (this.config.engine === "ejs") {
      html = await this.renderEJS(templatePath, data);
    } else {
      html = await this.renderHandlebars(templatePath, data);
    }

    // Apply layout if configured
    if (this.config.defaultLayout && this.config.layoutsPath) {
      html = await this.applyLayout(html, data);
    }

    // Generate plain text version
    const text = this.htmlToText(html);

    return { html, text };
  }

  /**
   * Render EJS template
   */
  private static async renderEJS(
    templatePath: string,
    data: Record<string, any>
  ): Promise<string> {
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
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }

  /**
   * Apply layout to rendered content
   */
  private static async applyLayout(
    content: string,
    data: Record<string, any>
  ): Promise<string> {
    if (!this.config?.layoutsPath || !this.config.defaultLayout) {
      return content;
    }

    const layoutPath = path.join(
      process.cwd(),
      this.config.layoutsPath,
      `${this.config.defaultLayout}.${
        this.config.engine === "ejs" ? "ejs" : "hbs"
      }`
    );

    if (!fs.existsSync(layoutPath)) {
      return content;
    }

    const layoutData = { ...data, body: content };

    if (this.config.engine === "ejs") {
      return ejs.renderFile(layoutPath, layoutData);
    } else {
      const Handlebars = require("handlebars");
      const template = fs.readFileSync(layoutPath, "utf-8");
      const compiled = Handlebars.compile(template);
      return compiled(layoutData);
    }
  }

  /**
   * Convert HTML to plain text
   */
  private static htmlToText(html: string): string {
    // Robustly convert HTML to plain text using a well-tested library
    return convertHtmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { ignoreHref: true } },
      ],
    })
      .replace(/\s+/g, " ")
      .trim();
  }
}
