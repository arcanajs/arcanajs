/**
 * Mail Configuration
 *
 * Configure your email sending settings here.
 * Supports multiple mail drivers: SMTP, SendGrid, Mailgun, AWS SES
 */
import { MailConfig } from "arcanajs/mail";

const mailConfig: MailConfig = {
  /**
   * Default mail driver
   * Options: 'smtp', 'sendgrid', 'mailgun', 'ses', 'log'
   */
  default: (process.env.MAIL_DRIVER as any) || "log",

  /**
   * Default "from" address and name
   */
  from: {
    address: process.env.MAIL_FROM_ADDRESS || "noreply@arcanajs.com",
    name: process.env.MAIL_FROM_NAME || "ArcanaJS",
  },

  /**
   * SMTP Configuration
   */
  smtp: {
    host: process.env.SMTP_HOST || "smtp.mailtrap.io",
    port: Number(process.env.SMTP_PORT || "2525"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  },

  /**
   * SendGrid Configuration
   */
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || "",
  },

  /**
   * Mailgun Configuration
   */
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || "",
    domain: process.env.MAILGUN_DOMAIN || "",
    host: process.env.MAILGUN_HOST || "api.mailgun.net",
  },

  /**
   * AWS SES Configuration
   */
  ses: {
    region: process.env.AWS_SES_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },

  /**
   * Queue Configuration
   */
  queue: {
    enabled: process.env.MAIL_QUEUE_ENABLED === "true",
    driver: process.env.MAIL_QUEUE_DRIVER === "redis" ? "redis" : "memory",
    redis: process.env.REDIS_HOST
      ? {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
          db: Number(process.env.REDIS_MAIL_DB || "1"),
        }
      : undefined,
    retries: 3,
    retryDelay: 60, // seconds
  },

  /**
   * Template Configuration
   */
  templates: {
    engine: "ejs",
    viewsPath: "src/resources/emails",
    layoutsPath: "src/resources/emails/layouts",
    defaultLayout: "email",
    inlineCss: true,
  },

  /**
   * Reply-to address
   */
  replyTo: {
    address: process.env.MAIL_REPLY_TO || "",
    name: process.env.MAIL_REPLY_TO_NAME || "",
  },
};

export default mailConfig;
