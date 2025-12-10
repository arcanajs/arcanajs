import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

/**
 * Security Headers Middleware
 * Implements recommended security headers following OWASP guidelines
 */
export class SecurityHeaders {
  /**
   * Create security headers middleware
   */
  static middleware(options?: SecurityHeaderOptions) {
    const defaults: SecurityHeaderOptions = {
      contentSecurityPolicy: true,
      xssProtection: true,
      noSniff: true,
      frameOptions: "DENY",
      hsts: true,
      hstsMaxAge: 31536000, // 1 year
      hstsIncludeSubdomains: true,
      hstsPreload: false,
      referrerPolicy: "strict-origin-when-cross-origin",
      permissionsPolicy: true,
    };

    const settings = { ...defaults, ...options };

    return (req: Request, res: Response, next: NextFunction) => {
      // X-Content-Type-Options
      if (settings.noSniff) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      }

      // X-Frame-Options
      if (settings.frameOptions) {
        res.setHeader("X-Frame-Options", settings.frameOptions);
      }

      // X-XSS-Protection (legacy, but still useful for older browsers)
      if (settings.xssProtection) {
        res.setHeader("X-XSS-Protection", "1; mode=block");
      }

      // Strict-Transport-Security (HSTS)
      if (settings.hsts && req.secure) {
        let hstsValue = `max-age=${settings.hstsMaxAge}`;
        if (settings.hstsIncludeSubdomains) {
          hstsValue += "; includeSubDomains";
        }
        if (settings.hstsPreload) {
          hstsValue += "; preload";
        }
        res.setHeader("Strict-Transport-Security", hstsValue);
      }

      // Referrer-Policy
      if (settings.referrerPolicy) {
        res.setHeader("Referrer-Policy", settings.referrerPolicy);
      }

      // Content-Security-Policy
      if (settings.contentSecurityPolicy) {
        const csp =
          typeof settings.contentSecurityPolicy === "string"
            ? settings.contentSecurityPolicy
            : this.buildDefaultCSP(settings.cspDirectives);
        res.setHeader("Content-Security-Policy", csp);
      }

      // Permissions-Policy (formerly Feature-Policy)
      if (settings.permissionsPolicy) {
        const policy =
          typeof settings.permissionsPolicy === "string"
            ? settings.permissionsPolicy
            : this.buildDefaultPermissionsPolicy();
        res.setHeader("Permissions-Policy", policy);
      }

      // Cache-Control for sensitive endpoints
      if (this.isSensitiveEndpoint(req.path)) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private"
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }

      next();
    };
  }

  /**
   * Build default Content-Security-Policy
   */
  private static buildDefaultCSP(directives?: CSPDirectives): string {
    const defaults: CSPDirectives = {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      ...directives,
    };

    return Object.entries(defaults)
      .map(([key, values]) => `${key} ${values.join(" ")}`)
      .join("; ");
  }

  /**
   * Build default Permissions-Policy
   */
  private static buildDefaultPermissionsPolicy(): string {
    return [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", ");
  }

  /**
   * Check if endpoint is sensitive (auth-related)
   */
  private static isSensitiveEndpoint(path: string): boolean {
    const sensitivePatterns = [
      /\/auth\//i,
      /\/login/i,
      /\/logout/i,
      /\/register/i,
      /\/password/i,
      /\/token/i,
      /\/api\/v\d+\/auth/i,
    ];
    return sensitivePatterns.some((pattern) => pattern.test(path));
  }
}

/**
 * Security header options
 */
export interface SecurityHeaderOptions {
  contentSecurityPolicy?: boolean | string;
  cspDirectives?: CSPDirectives;
  xssProtection?: boolean;
  noSniff?: boolean;
  frameOptions?: "DENY" | "SAMEORIGIN" | false;
  hsts?: boolean;
  hstsMaxAge?: number;
  hstsIncludeSubdomains?: boolean;
  hstsPreload?: boolean;
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
    | false;
  permissionsPolicy?: boolean | string;
}

/**
 * CSP directives
 */
export interface CSPDirectives {
  [key: string]: string[];
}

/**
 * IP Validator for whitelist/blacklist management
 */
export class IPValidator {
  private whitelist: Set<string> = new Set();
  private blacklist: Set<string> = new Set();
  private cidrRanges: CIDRRange[] = [];

  constructor(config?: { whitelist?: string[]; blacklist?: string[] }) {
    if (config?.whitelist) {
      config.whitelist.forEach((ip) => this.addToWhitelist(ip));
    }
    if (config?.blacklist) {
      config.blacklist.forEach((ip) => this.addToBlacklist(ip));
    }
  }

  /**
   * Add IP to whitelist
   */
  addToWhitelist(ip: string): void {
    if (ip.includes("/")) {
      this.cidrRanges.push({ range: ip, type: "whitelist" });
    } else {
      this.whitelist.add(ip);
    }
  }

  /**
   * Add IP to blacklist
   */
  addToBlacklist(ip: string): void {
    if (ip.includes("/")) {
      this.cidrRanges.push({ range: ip, type: "blacklist" });
    } else {
      this.blacklist.add(ip);
    }
  }

  /**
   * Check if IP is allowed
   */
  isAllowed(ip: string): boolean {
    // Blacklist takes precedence
    if (this.blacklist.has(ip)) {
      return false;
    }

    // Check CIDR blacklist
    for (const range of this.cidrRanges) {
      if (range.type === "blacklist" && this.isInCIDR(ip, range.range)) {
        return false;
      }
    }

    // If whitelist is empty, allow by default
    if (
      this.whitelist.size === 0 &&
      !this.cidrRanges.some((r) => r.type === "whitelist")
    ) {
      return true;
    }

    // Check whitelist
    if (this.whitelist.has(ip)) {
      return true;
    }

    // Check CIDR whitelist
    for (const range of this.cidrRanges) {
      if (range.type === "whitelist" && this.isInCIDR(ip, range.range)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range (simplified IPv4 check)
   */
  private isInCIDR(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * Convert IP string to number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split(".");
    return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  }

  /**
   * Create middleware to validate IPs
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);

      if (!this.isAllowed(clientIP)) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
          code: "IP_BLOCKED",
          timestamp: new Date().toISOString(),
        });
      }

      next();
    };
  }

  /**
   * Get client IP
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(",")[0];
      return ips.trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  }
}

interface CIDRRange {
  range: string;
  type: "whitelist" | "blacklist";
}

/**
 * Security utility functions
 */
export class SecurityUtils {
  /**
   * Generate a cryptographically secure random string
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Generate a URL-safe secure token
   */
  static generateUrlSafeToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("base64url");
  }

  /**
   * Hash data using SHA-256
   */
  static sha256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Hash data using SHA-512
   */
  static sha512(data: string): string {
    return crypto.createHash("sha512").update(data).digest("hex");
  }

  /**
   * Create HMAC signature
   */
  static hmac(
    data: string,
    secret: string,
    algorithm: string = "sha256"
  ): string {
    return crypto.createHmac(algorithm, secret).update(data).digest("hex");
  }

  /**
   * Timing-safe string comparison
   */
  static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do comparison to avoid timing leak
      crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitive(value: string, visibleChars: number = 4): string {
    if (value.length <= visibleChars * 2) {
      return "*".repeat(value.length);
    }
    const start = value.slice(0, visibleChars);
    const end = value.slice(-visibleChars);
    const middle = "*".repeat(Math.min(value.length - visibleChars * 2, 8));
    return `${start}${middle}${end}`;
  }

  /**
   * Sanitize string to prevent injection
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/(?:javascript:|data:|vbscript:)/gi, "") // Remove dangerous protocols
      .replace(/on\w+=/gi, "") // Remove event handlers
      .trim();
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Generate a secure nonce for CSP
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString("base64");
  }

  /**
   * Create a secure cookie options object
   */
  static getSecureCookieOptions(maxAge?: number): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    maxAge: number;
    path: string;
  } {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  static encrypt(plaintext: string, key: string): string {
    const iv = crypto.randomBytes(12);
    const keyBuffer = crypto.scryptSync(key, "salt", 32);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  static decrypt(ciphertext: string, key: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const keyBuffer = crypto.scryptSync(key, "salt", 32);

    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

/**
 * Audit Logger for security events
 */
export class AuditLogger {
  private static enabled: boolean = true;
  private static logHandler?: (event: AuditEvent) => void;

  /**
   * Configure audit logging
   */
  static configure(options: {
    enabled?: boolean;
    handler?: (event: AuditEvent) => void;
  }): void {
    if (options.enabled !== undefined) {
      this.enabled = options.enabled;
    }
    if (options.handler) {
      this.logHandler = options.handler;
    }
  }

  /**
   * Log an audit event
   */
  static log(event: Omit<AuditEvent, "timestamp">): void {
    if (!this.enabled) return;

    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    if (this.logHandler) {
      this.logHandler(auditEvent);
    } else {
      console.log("[AUDIT]", JSON.stringify(auditEvent));
    }
  }

  /**
   * Log authentication attempt
   */
  static logAuth(
    action:
      | "login"
      | "logout"
      | "register"
      | "password_reset"
      | "token_refresh",
    success: boolean,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log({
      category: "auth",
      action,
      success,
      userId,
      metadata,
    });
  }

  /**
   * Log access attempt
   */
  static logAccess(
    resource: string,
    action: string,
    allowed: boolean,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log({
      category: "access",
      action: `${action}:${resource}`,
      success: allowed,
      userId,
      metadata,
    });
  }

  /**
   * Log security event
   */
  static logSecurity(
    event: string,
    severity: "low" | "medium" | "high" | "critical",
    metadata?: Record<string, any>
  ): void {
    this.log({
      category: "security",
      action: event,
      success: false,
      severity,
      metadata,
    });
  }
}

/**
 * Audit event structure
 */
export interface AuditEvent {
  timestamp: string;
  category: "auth" | "access" | "security" | "data";
  action: string;
  success: boolean;
  userId?: string;
  severity?: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, any>;
}
