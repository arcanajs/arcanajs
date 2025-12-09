import { ModuleLoader } from "../../utils/ModuleLoader";
import { MailAttachment, MailMessage, MailSendResult } from "./types";

/**
 * Mailable options for send/queue
 */
interface MailableOptions {
  /** Queue priority */
  priority?: "high" | "normal" | "low";
  /** Delay in milliseconds before sending */
  delay?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Abstract base class for creating email messages
 *
 * @example
 * ```typescript
 * class WelcomeEmail extends Mailable {
 *   constructor(private user: User) {
 *     super();
 *   }
 *
 *   build() {
 *     return this
 *       .to(this.user.email)
 *       .subject('Welcome to ArcanaJS!')
 *       .view('emails/welcome', { name: this.user.name })
 *       .tag('welcome', 'onboarding')
 *       .metadata({ userId: this.user.id });
 *   }
 * }
 *
 * // Send the email
 * const result = await new WelcomeEmail(user).send();
 *
 * // Queue with priority
 * await new WelcomeEmail(user).queue({ priority: 'high' });
 *
 * // Schedule for later
 * await new WelcomeEmail(user)
 *   .schedule(new Date('2024-12-25'))
 *   .queue();
 * ```
 */
export abstract class Mailable {
  protected message: Partial<MailMessage> = {};
  protected viewName?: string;
  protected viewData?: Record<string, any>;
  protected queueOptions?: MailableOptions;

  /**
   * Build the email message
   * Must be implemented by subclasses
   */
  abstract build(): this;

  /**
   * Set the recipient(s)
   */
  to(address: string | string[], name?: string): this {
    if (name && typeof address === "string") {
      this.message.to = `"${name}" <${address}>`;
    } else {
      this.message.to = address;
    }
    return this;
  }

  /**
   * Set the sender
   */
  from(address: string, name?: string): this {
    this.message.from = { address, name };
    return this;
  }

  /**
   * Set the email subject
   */
  subject(subject: string): this {
    this.message.subject = subject;
    return this;
  }

  /**
   * Set the email view template
   */
  view(template: string, data?: Record<string, any>): this {
    this.viewName = template;
    this.viewData = data;
    return this;
  }

  /**
   * Set HTML content directly
   */
  html(content: string): this {
    this.message.html = content;
    return this;
  }

  /**
   * Set plain text content
   */
  text(content: string): this {
    this.message.text = content;
    return this;
  }

  /**
   * Set markdown content (will be converted to HTML)
   */
  markdown(content: string, options?: { theme?: string }): this {
    // Store markdown for later processing
    (this.message as any)._markdown = content;
    (this.message as any)._markdownOptions = options;
    return this;
  }

  /**
   * Add CC recipient(s)
   */
  cc(address: string | string[]): this {
    this.message.cc = address;
    return this;
  }

  /**
   * Add BCC recipient(s)
   */
  bcc(address: string | string[]): this {
    this.message.bcc = address;
    return this;
  }

  /**
   * Set reply-to address
   */
  replyTo(address: string, name?: string): this {
    if (name) {
      this.message.replyTo = `"${name}" <${address}>`;
    } else {
      this.message.replyTo = address;
    }
    return this;
  }

  /**
   * Add an attachment
   */
  attach(attachment: MailAttachment): this {
    if (!this.message.attachments) {
      this.message.attachments = [];
    }
    this.message.attachments.push(attachment);
    return this;
  }

  /**
   * Attach a file from path
   */
  attachFromPath(
    path: string,
    options?: { filename?: string; contentType?: string }
  ): this {
    return this.attach({
      filename: options?.filename || path.split("/").pop() || "attachment",
      path,
      contentType: options?.contentType,
    });
  }

  /**
   * Attach data as a file
   */
  attachData(
    content: string | Buffer,
    filename: string,
    contentType?: string
  ): this {
    return this.attach({
      filename,
      content,
      contentType,
    });
  }

  /**
   * Attach from URL
   */
  attachFromUrl(url: string, filename?: string): this {
    return this.attach({
      filename: filename || url.split("/").pop() || "attachment",
      path: url,
    });
  }

  /**
   * Embed an inline image (for HTML emails)
   */
  embed(path: string, cid: string, contentType?: string): this {
    if (!this.message.attachments) {
      this.message.attachments = [];
    }
    this.message.attachments.push({
      filename: path.split("/").pop() || "image",
      path,
      cid,
      contentType,
    });
    return this;
  }

  /**
   * Embed raw data as inline image
   */
  embedData(
    content: Buffer,
    cid: string,
    filename: string,
    contentType?: string
  ): this {
    if (!this.message.attachments) {
      this.message.attachments = [];
    }
    this.message.attachments.push({
      filename,
      content,
      cid,
      contentType: contentType || "image/png",
    });
    return this;
  }

  /**
   * Set email priority
   */
  priority(level: "high" | "normal" | "low"): this {
    this.message.priority = level;
    return this;
  }

  /**
   * Add custom headers
   */
  withHeaders(headers: Record<string, string>): this {
    this.message.headers = { ...this.message.headers, ...headers };
    return this;
  }

  /**
   * Set a single header
   */
  header(name: string, value: string): this {
    if (!this.message.headers) {
      this.message.headers = {};
    }
    this.message.headers[name] = value;
    return this;
  }

  /**
   * Add tags for categorization/tracking
   */
  tag(...tags: string[]): this {
    if (!this.message.tags) {
      this.message.tags = [];
    }
    this.message.tags.push(...tags);
    return this;
  }

  /**
   * Add metadata for tracking
   */
  metadata(data: Record<string, any>): this {
    this.message.metadata = { ...this.message.metadata, ...data };
    return this;
  }

  /**
   * Schedule email for later delivery
   */
  schedule(sendAt: Date): this {
    this.message.scheduledAt = sendAt;
    return this;
  }

  /**
   * Set email as reply to another email (threading)
   */
  inReplyTo(messageId: string): this {
    this.message.inReplyTo = messageId;
    return this;
  }

  /**
   * Set references for email threading
   */
  references(...messageIds: string[]): this {
    this.message.references = messageIds;
    return this;
  }

  /**
   * Enable/disable tracking for this email
   */
  tracking(options: { opens?: boolean; clicks?: boolean }): this {
    this.message.trackingOptions = options;
    return this;
  }

  /**
   * Disable all tracking for this email
   */
  noTracking(): this {
    this.message.trackingOptions = { opens: false, clicks: false };
    return this;
  }

  /**
   * Set queue options
   */
  withQueueOptions(options: MailableOptions): this {
    this.queueOptions = { ...this.queueOptions, ...options };
    return this;
  }

  /**
   * Make this email high priority
   */
  highPriority(): this {
    this.message.priority = "high";
    this.queueOptions = { ...this.queueOptions, priority: "high" };
    return this;
  }

  /**
   * Make this email low priority
   */
  lowPriority(): this {
    this.message.priority = "low";
    this.queueOptions = { ...this.queueOptions, priority: "low" };
    return this;
  }

  /**
   * Set a delay before sending (when queued)
   */
  delay(ms: number): this {
    this.queueOptions = { ...this.queueOptions, delay: ms };
    return this;
  }

  /**
   * Delay until a specific date
   */
  delayUntil(date: Date): this {
    const ms = date.getTime() - Date.now();
    if (ms > 0) {
      this.queueOptions = { ...this.queueOptions, delay: ms };
    }
    return this;
  }

  /**
   * Set max retry attempts
   */
  maxRetries(count: number): this {
    this.queueOptions = { ...this.queueOptions, maxRetries: count };
    return this;
  }

  /**
   * Get the built message
   * @internal
   */
  getMessage(): {
    message: Partial<MailMessage>;
    viewName?: string;
    viewData?: Record<string, any>;
    queueOptions?: MailableOptions;
  } {
    this.build();

    // Process markdown if set
    const message = this.processMarkdown(this.message);

    return {
      message,
      viewName: this.viewName,
      viewData: this.viewData,
      queueOptions: this.queueOptions,
    };
  }

  /**
   * Process markdown content
   */
  private processMarkdown(message: Partial<MailMessage>): Partial<MailMessage> {
    const markdownContent = (message as any)._markdown;
    if (!markdownContent) return message;

    try {
      // Try to use marked if available
      const marked = ModuleLoader.require("marked");
      const html = marked.parse(markdownContent);

      // Wrap in basic email template
      message.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            a { color: #0066cc; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
            code { background: #f4f4f4; padding: 2px 4px; border-radius: 2px; }
            blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `;

      // Set plain text version
      message.text = markdownContent;
    } catch {
      // If marked is not available, use markdown as plain text
      message.text = markdownContent;
    }

    // Clean up temporary properties
    delete (message as any)._markdown;
    delete (message as any)._markdownOptions;

    return message;
  }

  /**
   * Render the email without sending (for preview)
   */
  async render(): Promise<{ html?: string; text?: string; subject?: string }> {
    const { message, viewName, viewData } = this.getMessage();

    if (viewName) {
      const { TemplateRenderer } = await import("./utils/TemplateRenderer");
      const { html, text } = await TemplateRenderer.render(viewName, viewData);
      return {
        html,
        text,
        subject: message.subject,
      };
    }

    return {
      html: message.html,
      text: message.text,
      subject: message.subject,
    };
  }

  /**
   * Send the email immediately
   */
  async send(): Promise<MailSendResult> {
    const { MailService } = await import("./MailService");
    return MailService.send(this);
  }

  /**
   * Queue the email for async sending
   */
  async queue(options?: MailableOptions): Promise<string> {
    const { MailService } = await import("./MailService");
    const mergedOptions = { ...this.queueOptions, ...options };
    return MailService.queue(this, mergedOptions);
  }

  /**
   * Send immediately or queue based on configuration
   */
  async deliver(options?: MailableOptions): Promise<MailSendResult | string> {
    const { MailService } = await import("./MailService");
    const config = MailService.getConfig();

    if (config?.queue?.enabled) {
      return this.queue(options);
    }

    return this.send();
  }

  /**
   * Clone this mailable with different recipient
   */
  clone(): this {
    const Constructor = this.constructor as new () => this;
    const instance = new Constructor();
    instance.message = JSON.parse(JSON.stringify(this.message));
    instance.viewName = this.viewName;
    instance.viewData = this.viewData ? { ...this.viewData } : undefined;
    instance.queueOptions = this.queueOptions
      ? { ...this.queueOptions }
      : undefined;
    return instance;
  }

  /**
   * Create multiple instances for different recipients
   */
  static forRecipients<T extends Mailable>(
    this: new (...args: any[]) => T,
    recipients: Array<{
      email: string;
      name?: string;
      data?: Record<string, any>;
    }>,
    ...constructorArgs: any[]
  ): T[] {
    return recipients.map((recipient) => {
      const instance = new this(...constructorArgs);
      instance.to(recipient.email, recipient.name);
      if (recipient.data) {
        instance.metadata(recipient.data);
      }
      return instance;
    });
  }
}

/**
 * Simple notification email (no template required)
 */
export class NotificationMail extends Mailable {
  constructor(
    private options: {
      to: string | string[];
      subject: string;
      message: string;
      html?: boolean;
    }
  ) {
    super();
  }

  build(): this {
    this.to(this.options.to).subject(this.options.subject);

    if (this.options.html) {
      this.html(this.options.message);
    } else {
      this.text(this.options.message);
    }

    return this;
  }
}

/**
 * Markdown-based email (converts markdown to HTML)
 */
export class MarkdownMail extends Mailable {
  constructor(
    private options: {
      to: string | string[];
      subject: string;
      content: string;
    }
  ) {
    super();
  }

  build(): this {
    return this.to(this.options.to)
      .subject(this.options.subject)
      .markdown(this.options.content);
  }
}
