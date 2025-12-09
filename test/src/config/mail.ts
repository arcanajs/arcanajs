/**
 * Mail Configuration
 *
 * Configure your email sending settings here.
 * Supports multiple mail drivers: SMTP, SendGrid, Mailgun, AWS SES, Postmark, Resend
 */
import { MailConfig } from "arcanajs/mail";

const mailConfig: MailConfig = {
  /**
   * Default mail driver
   * Options: 'smtp', 'sendgrid', 'mailgun', 'ses', 'postmark', 'resend', 'log', 'null'
   */
  default: (process.env.MAIL_DRIVER as any) || "log",

  /**
   * Sandbox mode - emails are not actually sent (for development)
   */
  sandbox:
    process.env.MAIL_SANDBOX === "true" ||
    process.env.NODE_ENV === "development",

  /**
   * Default "from" address and name
   */
  from: {
    address: process.env.MAIL_FROM_ADDRESS || "noreply@arcanajs.com",
    name: process.env.MAIL_FROM_NAME || "ArcanaJS",
  },

  /**
   * Reply-to address
   */
  replyTo: {
    address: process.env.MAIL_REPLY_TO || "",
    name: process.env.MAIL_REPLY_TO_NAME || "",
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
    // Connection pooling for high volume
    pool: process.env.SMTP_POOL === "true",
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || "5"),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || "100"),
    // Rate limiting
    rateDelta: Number(process.env.SMTP_RATE_DELTA || "1000"),
    rateLimit: Number(process.env.SMTP_RATE_LIMIT || "5"),
    // Timeouts
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || "30000"),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || "30000"),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || "300000"),
    // TLS options
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  },

  /**
   * SendGrid Configuration
   */
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || "",
    sandbox: process.env.SENDGRID_SANDBOX === "true",
    trackingSettings: {
      clickTracking: process.env.SENDGRID_CLICK_TRACKING !== "false",
      openTracking: process.env.SENDGRID_OPEN_TRACKING !== "false",
    },
  },

  /**
   * Mailgun Configuration
   */
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || "",
    domain: process.env.MAILGUN_DOMAIN || "",
    host: process.env.MAILGUN_HOST || "api.mailgun.net",
    eu: process.env.MAILGUN_EU === "true",
    tracking: {
      opens: process.env.MAILGUN_TRACK_OPENS !== "false",
      clicks: process.env.MAILGUN_TRACK_CLICKS !== "false",
    },
  },

  /**
   * AWS SES Configuration
   */
  ses: {
    region: process.env.AWS_SES_REGION || "us-east-1",
    // Use IAM role (recommended for EC2/ECS/Lambda)
    useIamRole: process.env.AWS_USE_IAM_ROLE === "true",
    // Or use access keys
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    sessionToken: process.env.AWS_SESSION_TOKEN,
    // Rate limiting
    sendingRate: Number(process.env.SES_SENDING_RATE || "0"), // 0 = no limit
    configurationSet: process.env.SES_CONFIGURATION_SET,
  },

  /**
   * Postmark Configuration
   */
  postmark: {
    apiKey: process.env.POSTMARK_API_KEY || "",
    messageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
  },

  /**
   * Resend Configuration
   */
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
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
    retries: Number(process.env.MAIL_QUEUE_RETRIES || "3"),
    retryDelay: Number(process.env.MAIL_QUEUE_RETRY_DELAY || "60"), // seconds
    concurrency: Number(process.env.MAIL_QUEUE_CONCURRENCY || "2"),
    pollInterval: Number(process.env.MAIL_QUEUE_POLL_INTERVAL || "1000"), // ms
  },

  /**
   * Template Configuration
   */
  templates: {
    engine:
      (process.env.MAIL_TEMPLATE_ENGINE as "ejs" | "handlebars" | "mjml") ||
      "ejs",
    viewsPath: "src/resources/emails",
    layoutsPath: "src/resources/emails/layouts",
    partialsPath: "src/resources/emails/partials",
    defaultLayout: "email",
    inlineCss: true,
    minify: process.env.NODE_ENV === "production",
    cache: process.env.NODE_ENV === "production",
    assetsUrl: process.env.MAIL_ASSETS_URL || "",
  },

  /**
   * Email Tracking Configuration
   */
  tracking: {
    enabled: process.env.MAIL_TRACKING_ENABLED === "true",
    trackOpens: process.env.MAIL_TRACK_OPENS !== "false",
    trackClicks: process.env.MAIL_TRACK_CLICKS !== "false",
    trackingDomain: process.env.MAIL_TRACKING_DOMAIN || "",
    webhookUrl: process.env.MAIL_TRACKING_WEBHOOK_URL || "",
    webhookSecret: process.env.MAIL_TRACKING_WEBHOOK_SECRET || "",
  },

  /**
   * Rate Limiting Configuration
   */
  rateLimit: {
    enabled: process.env.MAIL_RATE_LIMIT_ENABLED === "true",
    maxEmails: Number(process.env.MAIL_RATE_LIMIT_MAX || "100"),
    windowSize: Number(process.env.MAIL_RATE_LIMIT_WINDOW || "60"), // seconds
    perRecipient: process.env.MAIL_RATE_LIMIT_PER_RECIPIENT === "true",
    maxPerRecipient: Number(
      process.env.MAIL_RATE_LIMIT_MAX_PER_RECIPIENT || "5"
    ),
  },

  /**
   * Logging Configuration
   */
  logging: {
    enabled: process.env.MAIL_LOGGING_ENABLED !== "false",
    level:
      (process.env.MAIL_LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
      "info",
    maskSensitive: process.env.MAIL_LOG_MASK_SENSITIVE !== "false",
    includeContent: process.env.MAIL_LOG_INCLUDE_CONTENT === "true",
  },

  /**
   * DKIM Signing Configuration
   */
  dkim: process.env.DKIM_PRIVATE_KEY
    ? {
        domainName: process.env.DKIM_DOMAIN || "",
        keySelector: process.env.DKIM_SELECTOR || "default",
        privateKey: process.env.DKIM_PRIVATE_KEY,
      }
    : undefined,

  /**
   * Unsubscribe Configuration
   */
  unsubscribe: {
    enabled: process.env.MAIL_UNSUBSCRIBE_ENABLED === "true",
    url: process.env.MAIL_UNSUBSCRIBE_URL || "",
    oneClick: process.env.MAIL_UNSUBSCRIBE_ONE_CLICK === "true",
    email: process.env.MAIL_UNSUBSCRIBE_EMAIL || "",
  },

  /**
   * Bounce Handling Configuration
   */
  bounceHandling: {
    enabled: process.env.MAIL_BOUNCE_HANDLING_ENABLED === "true",
    webhookUrl: process.env.MAIL_BOUNCE_WEBHOOK_URL || "",
    autoSuppress: process.env.MAIL_AUTO_SUPPRESS_BOUNCES !== "false",
    hardBounceThreshold: Number(process.env.MAIL_HARD_BOUNCE_THRESHOLD || "1"),
    softBounceThreshold: Number(process.env.MAIL_SOFT_BOUNCE_THRESHOLD || "3"),
  },
};

export default mailConfig;
