import { Transporter } from "nodemailer";

/**
 * Supported mail transport drivers
 */
export type MailDriver =
  | "smtp"
  | "sendgrid"
  | "mailgun"
  | "ses"
  | "postmark"
  | "resend"
  | "log"
  | "null";

/**
 * SMTP Configuration
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
    minVersion?: string;
    ciphers?: string;
  };
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Greeting timeout in milliseconds */
  greetingTimeout?: number;
  /** Socket timeout in milliseconds */
  socketTimeout?: number;
  /** Enable connection pooling */
  pool?: boolean;
  /** Maximum connections in pool */
  maxConnections?: number;
  /** Maximum messages per connection */
  maxMessages?: number;
  /** Rate limiting - messages per second */
  rateDelta?: number;
  /** Rate limiting - max messages per rateDelta */
  rateLimit?: number;
}

/**
 * SendGrid Configuration
 */
export interface SendGridConfig {
  apiKey: string;
  /** Use SendGrid API instead of SMTP */
  useApi?: boolean;
  /** Sandbox mode for testing */
  sandbox?: boolean;
  /** Tracking settings */
  trackingSettings?: {
    clickTracking?: boolean;
    openTracking?: boolean;
    subscriptionTracking?: boolean;
    ganalytics?: boolean;
  };
}

/**
 * Mailgun Configuration
 */
export interface MailgunConfig {
  apiKey: string;
  domain: string;
  host?: string;
  /** EU region endpoint */
  eu?: boolean;
  /** Enable tracking (legacy) */
  tracking?:
    | boolean
    | {
        opens?: boolean;
        clicks?: boolean;
      };
  /** Track clicks (legacy) */
  trackClicks?: boolean;
  /** Track opens (legacy) */
  trackOpens?: boolean;
}

/**
 * AWS SES Configuration
 */
export interface SESConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** Use IAM role (no credentials needed) */
  useIamRole?: boolean;
  /** Configuration set name for tracking */
  configurationSet?: string;
  /** Rate limiting - messages per second */
  sendingRate?: number;
}

/**
 * Postmark Configuration
 */
export interface PostmarkConfig {
  apiKey: string;
  /** Message stream ID */
  messageStream?: string;
  /** Track opens */
  trackOpens?: boolean;
  /** Track links */
  trackLinks?: "None" | "HtmlAndText" | "HtmlOnly" | "TextOnly";
}

/**
 * Resend Configuration
 */
export interface ResendConfig {
  apiKey: string;
}

/**
 * Mail Queue Configuration
 */
export interface MailQueueConfig {
  /** Enable email queuing */
  enabled: boolean;
  /** Queue storage driver */
  driver: "memory" | "redis" | "database";
  /** Redis configuration */
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    /** TLS connection */
    tls?: boolean;
    /** Key prefix */
    prefix?: string;
  };
  /** Number of retry attempts */
  retries?: number;
  /** Delay between retries in seconds */
  retryDelay?: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Maximum retry delay in seconds */
  maxRetryDelay?: number;
  /** Concurrent workers */
  concurrency?: number;
  /** Job timeout in seconds */
  timeout?: number;
  /** Enable dead letter queue */
  deadLetterQueue?: boolean;
  /** Process interval in milliseconds */
  processInterval?: number;
  /** Poll interval in milliseconds */
  pollInterval?: number;
}

/**
 * Mail Template Configuration
 */
export interface MailTemplateConfig {
  /** Template engine */
  engine: "ejs" | "handlebars" | "mjml" | "react-email";
  /** Path to email templates */
  viewsPath: string;
  /** Path to layout templates */
  layoutsPath?: string;
  /** Path to partial templates */
  partialsPath?: string;
  /** Default layout name */
  defaultLayout?: string;
  /** Inline CSS styles */
  inlineCss?: boolean;
  /** Minify HTML output */
  minify?: boolean;
  /** Enable template caching */
  cache?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Custom helpers for templates */
  helpers?: Record<string, (...args: any[]) => any>;
  /** Global template data */
  globals?: Record<string, any>;
  /** Assets base URL */
  assetsUrl?: string;
}

/**
 * Default Sender Configuration
 */
export interface MailFromConfig {
  address: string;
  name?: string;
}

/**
 * Email Tracking Configuration
 */
export interface MailTrackingConfig {
  /** Enable email tracking */
  enabled: boolean;
  /** Track email opens */
  trackOpens?: boolean;
  /** Track link clicks */
  trackClicks?: boolean;
  /** Webhook URL for tracking events */
  webhookUrl?: string;
  /** Webhook secret for signature verification */
  webhookSecret?: string;
  /** Custom tracking domain */
  trackingDomain?: string;
}

/**
 * Email Rate Limiting Configuration
 */
export interface MailRateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;
  /** Maximum emails per time window */
  maxEmails: number;
  /** Time window in seconds */
  windowSize: number;
  /** Per-recipient rate limiting */
  perRecipient?: boolean;
  /** Maximum emails per recipient per window */
  maxPerRecipient?: number;
}

/**
 * Email Logging Configuration
 */
export interface MailLoggingConfig {
  /** Enable email logging */
  enabled: boolean;
  /** Log level */
  level: "debug" | "info" | "warn" | "error";
  /** Log email content */
  logContent?: boolean;
  /** Include email content in logs (alias for logContent) */
  includeContent?: boolean;
  /** Mask sensitive data */
  maskSensitive?: boolean;
  /** Custom log handler */
  handler?: (log: MailLogEntry) => void;
}

/**
 * Mail Log Entry
 */
export interface MailLogEntry {
  timestamp: Date;
  level: string;
  messageId?: string;
  to: string | string[];
  from: string;
  subject: string;
  status: "sent" | "queued" | "failed" | "bounced" | "delivered";
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * DKIM Signing Configuration
 */
export interface DKIMConfig {
  domainName: string;
  keySelector: string;
  privateKey: string;
}

/**
 * Unsubscribe Configuration
 */
export interface UnsubscribeConfig {
  /** Enable unsubscribe link */
  enabled: boolean;
  /** Unsubscribe URL */
  url: string;
  /** One-click unsubscribe */
  oneClick?: boolean;
  /** Unsubscribe email address */
  email?: string;
}

/**
 * Bounce Handling Configuration
 */
export interface MailBounceConfig {
  /** Enable bounce handling */
  enabled: boolean;
  /** Webhook URL for bounce notifications */
  webhookUrl?: string;
  /** Auto-suppress bounced addresses */
  autoSuppress?: boolean;
  /** Hard bounce threshold before suppression */
  hardBounceThreshold?: number;
  /** Soft bounce threshold before suppression */
  softBounceThreshold?: number;
}

/**
 * Main Mail Configuration
 */
export interface MailConfig {
  /**
   * Default mail driver to use
   */
  default: MailDriver;

  /**
   * Default "from" address and name
   */
  from: MailFromConfig;

  /**
   * SMTP Configuration
   */
  smtp?: SMTPConfig;

  /**
   * SendGrid Configuration
   */
  sendgrid?: SendGridConfig;

  /**
   * Mailgun Configuration
   */
  mailgun?: MailgunConfig;

  /**
   * AWS SES Configuration
   */
  ses?: SESConfig;

  /**
   * Postmark Configuration
   */
  postmark?: PostmarkConfig;

  /**
   * Resend Configuration
   */
  resend?: ResendConfig;

  /**
   * Queue Configuration
   */
  queue?: MailQueueConfig;

  /**
   * Template Configuration
   */
  templates?: MailTemplateConfig;

  /**
   * Reply-to address
   */
  replyTo?: MailFromConfig;

  /**
   * Email Tracking Configuration
   */
  tracking?: MailTrackingConfig;

  /**
   * Rate Limiting Configuration
   */
  rateLimit?: MailRateLimitConfig;

  /**
   * Logging Configuration
   */
  logging?: MailLoggingConfig;

  /**
   * Sandbox/Test mode - emails are not actually sent
   */
  sandbox?: boolean;

  /**
   * Global email footer (appended to all emails)
   */
  footer?: string;

  /**
   * Unsubscribe configuration
   */
  unsubscribe?: UnsubscribeConfig;

  /**
   * DKIM signing configuration
   */
  dkim?: DKIMConfig;

  /**
   * Bounce handling configuration
   */
  bounceHandling?: MailBounceConfig;
}

/**
 * Mail Message Options
 */
export interface MailMessage {
  to: string | string[];
  from?: MailFromConfig;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: MailAttachment[];
  headers?: Record<string, string>;
  priority?: "high" | "normal" | "low";
  /** Custom message ID */
  messageId?: string;
  /** In-Reply-To header for threading */
  inReplyTo?: string;
  /** References header for threading */
  references?: string | string[];
  /** Tags for categorization/tracking */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, any>;
  /** Schedule send time */
  scheduledAt?: Date;
  /** Tracking options override */
  tracking?: {
    opens?: boolean;
    clicks?: boolean;
  };
  /** Tracking options (alias for 'tracking') */
  trackingOptions?: {
    opens?: boolean;
    clicks?: boolean;
  };
  /** Alternative email addresses (failover) */
  alternatives?: Array<{
    contentType: string;
    content: string | Buffer;
  }>;
  /** List-Unsubscribe header */
  listUnsubscribe?: string;
  /** AMP HTML version */
  amp?: string;
}

/**
 * Mail Attachment
 */
export interface MailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  /** Content-ID for inline attachments */
  cid?: string;
  /** Encoding (base64, binary, etc.) */
  encoding?: string;
  /** Content-Disposition */
  contentDisposition?: "attachment" | "inline";
  /** Raw headers */
  headers?: Record<string, string>;
}

/**
 * Mail Send Result
 */
export interface MailSendResult {
  success: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  pending?: string[];
  response?: string;
  envelope?: {
    from: string;
    to: string[];
  };
  error?: MailError;
}

/**
 * Mail Error
 */
export interface MailError {
  code: string;
  message: string;
  originalError?: Error;
  retryable?: boolean;
}

/**
 * Bulk Mail Options
 */
export interface BulkMailOptions {
  /** Batch size for bulk sending */
  batchSize?: number;
  /** Delay between batches in ms */
  batchDelay?: number;
  /** Continue on individual failures */
  continueOnError?: boolean;
  /** Callback for each sent email */
  onSent?: (result: MailSendResult, index: number) => void;
  /** Callback for failures */
  onError?: (error: MailError, index: number) => void;
}

/**
 * Bulk Mail Result
 */
export interface BulkMailResult {
  total: number;
  sent: number;
  failed: number;
  results: MailSendResult[];
}

/**
 * Email Validation Result
 */
export interface EmailValidationResult {
  valid: boolean;
  email: string;
  normalized?: string;
  suggestion?: string;
  reason?: string;
  checks: {
    format: boolean;
    mx: boolean;
    disposable: boolean;
    role: boolean;
  };
}

/**
 * Nodemailer Transporter Type
 */
export type MailTransporter = Transporter;
