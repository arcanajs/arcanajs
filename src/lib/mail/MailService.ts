import * as nodemailer from "nodemailer";
import { Mailable } from "./Mailable";
import { MailQueue } from "./queue/MailQueue";
import {
  MailConfig,
  MailgunConfig,
  MailMessage,
  MailTransporter,
  SendGridConfig,
  SESConfig,
  SMTPConfig,
} from "./types";
import { TemplateRenderer } from "./utils/TemplateRenderer";

/**
 * Core mail service for sending emails
 */
export class MailService {
  private static config?: MailConfig;
  private static transporter?: MailTransporter;

  /**
   * Initialize the mail service
   */
  static async init(config: MailConfig) {
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

      case "log":
        return this.createLogTransporter();

      default:
        throw new Error(`Unsupported mail driver: ${config.default}`);
    }
  }

  /**
   * Create SMTP transporter
   */
  private static createSMTPTransporter(config: SMTPConfig): MailTransporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: config.tls,
    });
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
        host: config.host || "api.mailgun.net",
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

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      };
    }

    const ses = new SESClient(clientConfig);

    const transporterOptions = {
      SES: {
        ses,
        aws: { SendRawEmailCommand },
      },
    };

    return nodemailer.createTransport(transporterOptions as any);
  }

  /**
   * Create log-only transporter (for testing)
   */
  private static createLogTransporter(): MailTransporter {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }

  /**
   * Send an email immediately
   */
  static async send(mailable: Mailable | MailMessage): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error(
        "MailService not initialized. Call MailService.init() first."
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

    // Apply default from address if not specified
    if (!message.from && this.config.from) {
      message.from = this.config.from;
    }

    // Apply default reply-to if not specified
    if (!message.replyTo && this.config.replyTo) {
      message.replyTo = this.config.replyTo.address;
    }

    // Convert from object to string format
    const mailOptions = {
      ...message,
      from: message.from
        ? typeof message.from === "string"
          ? message.from
          : message.from.name
          ? `"${message.from.name}" <${message.from.address}>`
          : message.from.address
        : undefined,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      if (this.config.default === "log") {
        console.log("Email preview:");
        console.log("To:", message.to);
        console.log("Subject:", message.subject);
        console.log("---");
      } else {
        console.log(`Email sent: ${info.messageId}`);
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }

  /**
   * Queue an email for async sending
   */
  static async queue(mailable: Mailable): Promise<void> {
    if (!this.config?.queue?.enabled) {
      // If queue is not enabled, send immediately
      return this.send(mailable);
    }

    await MailQueue.add(mailable);
  }

  /**
   * Send a raw email message
   */
  static async sendRaw(message: MailMessage): Promise<void> {
    return this.send(message);
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
      throw new Error("MailService not initialized");
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("Mail transporter verification failed:", error);
      return false;
    }
  }
}
