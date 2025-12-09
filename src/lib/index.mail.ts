// ============================================================================
// Mail System Exports
// ============================================================================

// Core Services
export { Mailable, MarkdownMail, NotificationMail } from "./mail/Mailable";
export { MailProvider } from "./mail/MailProvider";
export { MailService, MailServiceError } from "./mail/MailService";
export { MailQueue } from "./mail/queue/MailQueue";
export { TemplateError, TemplateRenderer } from "./mail/utils/TemplateRenderer";

// Types - Drivers
export type {
  MailDriver,
  MailgunConfig,
  PostmarkConfig,
  ResendConfig,
  SendGridConfig,
  SESConfig,
  SMTPConfig,
} from "./mail/types";

// Types - Configuration
export type {
  DKIMConfig,
  MailBounceConfig,
  MailConfig,
  MailFromConfig,
  MailLoggingConfig,
  MailQueueConfig,
  MailRateLimitConfig,
  MailTemplateConfig,
  MailTrackingConfig,
  UnsubscribeConfig,
} from "./mail/types";

// Types - Messages
export type {
  BulkMailOptions,
  BulkMailResult,
  EmailValidationResult,
  MailAttachment,
  MailError,
  MailLogEntry,
  MailMessage,
  MailSendResult,
  MailTransporter,
} from "./mail/types";
