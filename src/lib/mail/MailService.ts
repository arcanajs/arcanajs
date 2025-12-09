import crypto from "crypto";
import * as nodemailer from "nodemailer";
import { Mailable } from "./Mailable";
import { MailQueue } from "./queue/MailQueue";
import {
  BulkMailOptions,
  BulkMailResult,
  MailConfig,
  MailError,
  MailgunConfig,
  MailLogEntry,
  MailMessage,
  MailSendResult,
  MailTransporter,
  PostmarkConfig,
  ResendConfig,
  SendGridConfig,
  SESConfig,
  SMTPConfig,
} from "./types";
import { TemplateRenderer } from "./utils/TemplateRenderer";

/**
 * Rate limit tracking
 */
interface RateLimitState {
  count: number;
  windowStart: number;
  perRecipient: Map<string, { count: number; windowStart: number }>;
}

/**
 * Core mail service for sending emails
 * Features: multiple drivers, rate limiting, tracking, bulk sending, logging
 */
export class MailService {
  private static config?: MailConfig;
  private static transporter?: MailTransporter;
  private static rateLimitState: RateLimitState = {
    count: 0,
    windowStart: Date.now(),
    perRecipient: new Map(),
  };
  private static suppressedEmails: Set<string> = new Set();

  /**
   * Initialize the mail service
   */
  static async init(config: MailConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
    this.transporter = await this.createTransporter(config);

    // Initialize template renderer if configured
    if (config.templates) {
      TemplateRenderer.init(config.templates);
    }

    // Initialize queue if enabled
    if (config.queue?.enabled) {
      await MailQueue.init(config.queue);
    }

    this.log("info", "MailService initialized", {
      driver: config.default,
      sandbox: config.sandbox,
    });
  }

  /**
   * Validate mail configuration
   */
  private static validateConfig(config: MailConfig): void {
    if (!config.default) {
      throw new MailServiceError("Mail driver is required", "CONFIG_ERROR");
    }

    if (!config.from?.address) {
      throw new MailServiceError(
        "Default from address is required",
        "CONFIG_ERROR"
      );
    }

    // Validate driver-specific config
    switch (config.default) {
      case "smtp":
        if (!config.smtp?.host) {
          throw new MailServiceError("SMTP host is required", "CONFIG_ERROR");
        }
        break;
      case "sendgrid":
        if (!config.sendgrid?.apiKey) {
          throw new MailServiceError(
            "SendGrid API key is required",
            "CONFIG_ERROR"
          );
        }
        break;
      case "mailgun":
        if (!config.mailgun?.apiKey || !config.mailgun?.domain) {
          throw new MailServiceError(
            "Mailgun API key and domain are required",
            "CONFIG_ERROR"
          );
        }
        break;
      case "ses":
        if (!config.ses?.region) {
          throw new MailServiceError("SES region is required", "CONFIG_ERROR");
        }
        break;
      case "postmark":
        if (!config.postmark?.apiKey) {
          throw new MailServiceError(
            "Postmark API key is required",
            "CONFIG_ERROR"
          );
        }
        break;
      case "resend":
        if (!config.resend?.apiKey) {
          throw new MailServiceError(
            "Resend API key is required",
            "CONFIG_ERROR"
          );
        }
        break;
    }
  }

  /**
   * Create nodemailer transporter based on configuration
   */
  private static async createTransporter(
    config: MailConfig
  ): Promise<MailTransporter> {
    switch (config.default) {
      case "smtp":
        return this.createSMTPTransporter(config.smtp!);

      case "sendgrid":
        return this.createSendGridTransporter(config.sendgrid!);

      case "mailgun":
        return this.createMailgunTransporter(config.mailgun!);

      case "ses":
        return this.createSESTransporter(config.ses!);

      case "postmark":
        return this.createPostmarkTransporter(config.postmark!);

      case "resend":
        return this.createResendTransporter(config.resend!);

      case "log":
        return this.createLogTransporter();

      case "null":
        return this.createNullTransporter();

      default:
        throw new MailServiceError(
          `Unsupported mail driver: ${config.default}`,
          "DRIVER_ERROR"
        );
    }
  }

  /**
   * Create SMTP transporter with enhanced options
   */
  private static createSMTPTransporter(config: SMTPConfig): MailTransporter {
    const options: nodemailer.TransportOptions = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: config.tls,
      connectionTimeout: config.connectionTimeout,
      greetingTimeout: config.greetingTimeout,
      socketTimeout: config.socketTimeout,
    } as any;

    // Add pooling if enabled
    if (config.pool) {
      (options as any).pool = true;
      (options as any).maxConnections = config.maxConnections || 5;
      (options as any).maxMessages = config.maxMessages || 100;
    }

    // Add rate limiting
    if (config.rateDelta || config.rateLimit) {
      (options as any).rateDelta = config.rateDelta || 1000;
      (options as any).rateLimit = config.rateLimit || 5;
    }

    // Add DKIM if configured
    if (this.config?.dkim) {
      (options as any).dkim = this.config.dkim;
    }

    return nodemailer.createTransport(options);
  }

  /**
   * Create SendGrid transporter
   */
  private static createSendGridTransporter(
    config: SendGridConfig
  ): MailTransporter {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: config.apiKey,
      },
    });
  }

  /**
   * Create Mailgun transporter
   */
  private static createMailgunTransporter(
    config: MailgunConfig
  ): MailTransporter {
    const nodemailerMailgun = require("nodemailer-mailgun-transport");
    return nodemailer.createTransport(
      nodemailerMailgun({
        auth: {
          api_key: config.apiKey,
          domain: config.domain,
        },
        host: config.eu
          ? "api.eu.mailgun.net"
          : config.host || "api.mailgun.net",
      })
    );
  }

  /**
   * Create AWS SES transporter
   */
  private static createSESTransporter(config: SESConfig): MailTransporter {
    const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");

    const clientConfig: Record<string, unknown> = {
      region: config.region,
    };

    // Only add credentials if not using IAM role
    if (!config.useIamRole && config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      };
    }

    const ses = new SESClient(clientConfig);

    const transporterOptions: any = {
      SES: {
        ses,
        aws: { SendRawEmailCommand },
      },
    };

    // Add rate limiting for SES
    if (config.sendingRate) {
      transporterOptions.sendingRate = config.sendingRate;
    }

    return nodemailer.createTransport(transporterOptions);
  }

  /**
   * Create Postmark transporter
   */
  private static createPostmarkTransporter(
    config: PostmarkConfig
  ): MailTransporter {
    try {
      const postmarkTransport = require("nodemailer-postmark-transport");
      return nodemailer.createTransport(
        postmarkTransport({
          auth: {
            apiKey: config.apiKey,
          },
        })
      );
    } catch (error) {
      if ((error as any).code === "MODULE_NOT_FOUND") {
        // Fallback to SMTP transport for Postmark
        return nodemailer.createTransport({
          host: "smtp.postmarkapp.com",
          port: 587,
          secure: false,
          auth: {
            user: config.apiKey,
            pass: config.apiKey,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Create Resend transporter
   */
  private static createResendTransporter(
    config: ResendConfig
  ): MailTransporter {
    // Resend uses their own SMTP relay
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: config.apiKey,
      },
    });
  }

  /**
   * Create log-only transporter (for development/testing)
   */
  private static createLogTransporter(): MailTransporter {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }

  /**
   * Create null transporter (emails are discarded)
   */
  private static createNullTransporter(): MailTransporter {
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  /**
   * Send an email immediately
   */
  static async send(mailable: Mailable | MailMessage): Promise<MailSendResult> {
    if (!this.transporter || !this.config) {
      throw new MailServiceError(
        "MailService not initialized. Call MailService.init() first.",
        "NOT_INITIALIZED"
      );
    }

    let message: MailMessage;

    if (mailable instanceof Mailable) {
      const { message: msg, viewName, viewData } = mailable.getMessage();

      // Render template if view is specified
      if (viewName && this.config.templates) {
        const { html, text } = await TemplateRenderer.render(
          viewName,
          viewData
        );
        msg.html = html;
        msg.text = text;
      }

      message = msg as MailMessage;
    } else {
      message = mailable;
    }

    // Check suppression list
    const recipients = this.normalizeRecipients(message.to);
    const suppressedRecipients = recipients.filter((r) =>
      this.suppressedEmails.has(r.toLowerCase())
    );

    if (suppressedRecipients.length > 0) {
      this.log("warn", "Suppressed recipients removed", {
        suppressed: suppressedRecipients,
      });
      const activeRecipients = recipients.filter(
        (r) => !this.suppressedEmails.has(r.toLowerCase())
      );
      if (activeRecipients.length === 0) {
        return {
          success: false,
          rejected: suppressedRecipients,
          error: {
            code: "ALL_SUPPRESSED",
            message: "All recipients are suppressed",
            retryable: false,
          },
        };
      }
      message.to = activeRecipients;
    }

    // Check rate limiting
    if (this.config.rateLimit?.enabled) {
      const rateLimitResult = this.checkRateLimit(recipients);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}ms`,
            retryable: true,
          },
        };
      }
    }

    // Apply defaults
    message = this.applyDefaults(message);

    // Add tracking if enabled
    if (this.config.tracking?.enabled && message.html) {
      message = this.addTracking(message);
    }

    // Add unsubscribe header if enabled
    if (this.config.unsubscribe?.enabled) {
      message = this.addUnsubscribeHeader(message);
    }

    // Sandbox mode - don't actually send
    if (this.config.sandbox) {
      return this.handleSandboxMode(message);
    }

    // Convert and send
    const mailOptions = this.convertToNodemailerOptions(message);

    try {
      const info = await this.transporter.sendMail(mailOptions);

      const result: MailSendResult = {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted as string[],
        rejected: info.rejected as string[],
        response: info.response,
        envelope: info.envelope,
      };

      // Update rate limit counters
      if (this.config.rateLimit?.enabled) {
        this.updateRateLimitCounters(recipients);
      }

      // Log success
      this.logEmail(message, "sent", result.messageId);

      if (this.config.default === "log") {
        console.log("📧 Email Preview:");
        console.log("To:", message.to);
        console.log("Subject:", message.subject);
        console.log("---");
        if (message.html) {
          console.log(message.html.substring(0, 500) + "...");
        }
      }

      return result;
    } catch (error) {
      const mailError: MailError = {
        code: (error as any).code || "SEND_ERROR",
        message: (error as Error).message,
        originalError: error as Error,
        retryable: this.isRetryableError(error as Error),
      };

      this.logEmail(message, "failed", undefined, mailError.message);

      return {
        success: false,
        error: mailError,
      };
    }
  }

  /**
   * Send bulk emails
   */
  static async sendBulk(
    messages: Array<Mailable | MailMessage>,
    options?: BulkMailOptions
  ): Promise<BulkMailResult> {
    const batchSize = options?.batchSize || 50;
    const batchDelay = options?.batchDelay || 1000;
    const results: MailSendResult[] = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (message, index) => {
          try {
            const result = await this.send(message);
            if (result.success) {
              sent++;
              options?.onSent?.(result, i + index);
            } else {
              failed++;
              if (result.error) {
                options?.onError?.(result.error, i + index);
              }
            }
            return result;
          } catch (error) {
            failed++;
            const mailError: MailError = {
              code: "SEND_ERROR",
              message: (error as Error).message,
              retryable: true,
            };
            options?.onError?.(mailError, i + index);
            return { success: false, error: mailError };
          }
        })
      );

      results.push(...batchResults);

      // Delay between batches
      if (i + batchSize < messages.length) {
        await this.delay(batchDelay);
      }
    }

    return {
      total: messages.length,
      sent,
      failed,
      results,
    };
  }

  /**
   * Queue an email for async sending
   */
  static async queue(
    mailable: Mailable,
    options?: { priority?: "high" | "normal" | "low"; delay?: number }
  ): Promise<string> {
    if (!this.config?.queue?.enabled) {
      // If queue is not enabled, send immediately
      await this.send(mailable);
      return "immediate";
    }

    return await MailQueue.add(mailable, options);
  }

  /**
   * Send a raw email message
   */
  static async sendRaw(message: MailMessage): Promise<MailSendResult> {
    return this.send(message);
  }

  /**
   * Add email to suppression list
   */
  static suppress(email: string): void {
    this.suppressedEmails.add(email.toLowerCase());
  }

  /**
   * Remove email from suppression list
   */
  static unsuppress(email: string): void {
    this.suppressedEmails.delete(email.toLowerCase());
  }

  /**
   * Check if email is suppressed
   */
  static isSuppressed(email: string): boolean {
    return this.suppressedEmails.has(email.toLowerCase());
  }

  /**
   * Get the mail configuration
   */
  static getConfig(): MailConfig | undefined {
    return this.config;
  }

  /**
   * Verify transporter connection
   */
  static async verify(): Promise<boolean> {
    if (!this.transporter) {
      throw new MailServiceError(
        "MailService not initialized",
        "NOT_INITIALIZED"
      );
    }

    if (this.config?.default === "log" || this.config?.default === "null") {
      return true;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("Mail transporter verification failed:", error);
      return false;
    }
  }

  /**
   * Close transporter connection
   */
  static async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
    }
    await MailQueue.shutdown();
  }

  /**
   * Apply default values to message
   */
  private static applyDefaults(message: MailMessage): MailMessage {
    if (!message.from && this.config?.from) {
      message.from = this.config.from;
    }

    if (!message.replyTo && this.config?.replyTo) {
      message.replyTo = this.config.replyTo.address;
    }

    // Generate message ID if not provided
    if (!message.messageId) {
      message.messageId = this.generateMessageId();
    }

    return message;
  }

  /**
   * Convert message to nodemailer options
   */
  private static convertToNodemailerOptions(message: MailMessage): any {
    return {
      ...message,
      from: message.from
        ? typeof message.from === "string"
          ? message.from
          : message.from.name
          ? `"${message.from.name}" <${message.from.address}>`
          : message.from.address
        : undefined,
      headers: {
        ...message.headers,
        "X-Mailer": "ArcanaJS Mail",
        ...(message.tags ? { "X-Tags": message.tags.join(",") } : {}),
      },
    };
  }

  /**
   * Add tracking pixels and link tracking
   */
  private static addTracking(message: MailMessage): MailMessage {
    const trackingId = crypto.randomBytes(16).toString("hex");

    // Add open tracking pixel
    if (this.config?.tracking?.trackOpens && message.html) {
      const trackingPixel = `<img src="${
        this.config.tracking.trackingDomain || ""
      }/track/open/${trackingId}" width="1" height="1" style="display:none" />`;
      message.html = message.html.replace("</body>", `${trackingPixel}</body>`);
    }

    // Track clicks (simplified - would need link rewriting for full implementation)
    if (this.config?.tracking?.trackClicks) {
      message.metadata = {
        ...message.metadata,
        trackingId,
      };
    }

    return message;
  }

  /**
   * Add unsubscribe header
   */
  private static addUnsubscribeHeader(message: MailMessage): MailMessage {
    if (this.config?.unsubscribe?.url) {
      const recipient = Array.isArray(message.to) ? message.to[0] : message.to;
      const unsubUrl = `${
        this.config.unsubscribe.url
      }?email=${encodeURIComponent(recipient)}`;

      message.headers = {
        ...message.headers,
        "List-Unsubscribe": `<${unsubUrl}>`,
        ...(this.config.unsubscribe.oneClick
          ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : {}),
      };
    }

    return message;
  }

  /**
   * Handle sandbox mode
   */
  private static handleSandboxMode(message: MailMessage): MailSendResult {
    const messageId = this.generateMessageId();

    this.log("info", "Sandbox mode - email not sent", {
      messageId,
      to: message.to,
      subject: message.subject,
    });

    console.log("📧 [SANDBOX] Email would be sent:");
    console.log("To:", message.to);
    console.log("From:", message.from);
    console.log("Subject:", message.subject);
    console.log("---");

    return {
      success: true,
      messageId,
      accepted: this.normalizeRecipients(message.to),
    };
  }

  /**
   * Check rate limiting
   */
  private static checkRateLimit(recipients: string[]): {
    allowed: boolean;
    retryAfter?: number;
  } {
    if (!this.config?.rateLimit?.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowSize = (this.config.rateLimit.windowSize || 60) * 1000;

    // Reset window if expired
    if (now - this.rateLimitState.windowStart > windowSize) {
      this.rateLimitState.count = 0;
      this.rateLimitState.windowStart = now;
      this.rateLimitState.perRecipient.clear();
    }

    // Check global limit
    if (this.rateLimitState.count >= (this.config.rateLimit.maxEmails || 100)) {
      return {
        allowed: false,
        retryAfter: windowSize - (now - this.rateLimitState.windowStart),
      };
    }

    // Check per-recipient limit
    if (this.config.rateLimit.perRecipient) {
      for (const recipient of recipients) {
        const recipientState = this.rateLimitState.perRecipient.get(recipient);
        if (recipientState) {
          if (
            recipientState.count >=
            (this.config.rateLimit.maxPerRecipient || 10)
          ) {
            return {
              allowed: false,
              retryAfter: windowSize - (now - recipientState.windowStart),
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Update rate limit counters
   */
  private static updateRateLimitCounters(recipients: string[]): void {
    this.rateLimitState.count++;

    if (this.config?.rateLimit?.perRecipient) {
      const now = Date.now();
      for (const recipient of recipients) {
        const state = this.rateLimitState.perRecipient.get(recipient);
        if (state) {
          state.count++;
        } else {
          this.rateLimitState.perRecipient.set(recipient, {
            count: 1,
            windowStart: now,
          });
        }
      }
    }
  }

  /**
   * Normalize recipients to array
   */
  private static normalizeRecipients(to: string | string[]): string[] {
    return Array.isArray(to) ? to : [to];
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error): boolean {
    const retryableCodes = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ESOCKET",
      "ENOTFOUND",
    ];
    return retryableCodes.includes((error as any).code);
  }

  /**
   * Generate a unique message ID
   */
  private static generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString("hex");
    const domain =
      this.config?.from?.address?.split("@")[1] || "arcanajs.local";
    return `<${timestamp}.${random}@${domain}>`;
  }

  /**
   * Log email activity
   */
  private static logEmail(
    message: MailMessage,
    status: MailLogEntry["status"],
    messageId?: string,
    error?: string
  ): void {
    if (!this.config?.logging?.enabled) return;

    const logEntry: MailLogEntry = {
      timestamp: new Date(),
      level: status === "failed" ? "error" : "info",
      messageId,
      to: message.to,
      from:
        typeof message.from === "string"
          ? message.from
          : message.from?.address || "",
      subject: message.subject,
      status,
      error,
      metadata: message.metadata,
    };

    // Mask sensitive data if configured
    if (this.config.logging.maskSensitive) {
      logEntry.to = this.maskEmails(logEntry.to);
    }

    if (this.config.logging.handler) {
      this.config.logging.handler(logEntry);
    } else {
      const logFn = status === "failed" ? console.error : console.log;
      logFn(`[Mail] ${status.toUpperCase()}:`, logEntry);
    }
  }

  /**
   * General logging
   */
  private static log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, any>
  ): void {
    if (!this.config?.logging?.enabled) return;

    const levels = ["debug", "info", "warn", "error"];
    const configLevel = this.config.logging.level || "info";
    if (levels.indexOf(level) < levels.indexOf(configLevel)) return;

    const logFn = console[level] || console.log;
    logFn(`[Mail] ${message}`, data || "");
  }

  /**
   * Mask email addresses
   */
  private static maskEmails(emails: string | string[]): string | string[] {
    const mask = (email: string) => {
      const [local, domain] = email.split("@");
      return `${local[0]}***@${domain}`;
    };

    return Array.isArray(emails) ? emails.map(mask) : mask(emails);
  }

  /**
   * Delay helper
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Mail Service Error
 */
export class MailServiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "MailServiceError";
    this.code = code;
  }
}
