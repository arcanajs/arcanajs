import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AuthConfig } from "../types";

/**
 * Password strength validation result
 */
export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

/**
 * Secure Password Hasher with validation and multiple algorithm support
 * Implements OWASP password security best practices
 */
export class PasswordHasher {
  private static config: AuthConfig["password"];
  private static readonly DEFAULT_SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;
  private static readonly MAX_PASSWORD_LENGTH = 128;

  /**
   * Initialize with configuration
   */
  static init(config?: AuthConfig["password"]) {
    this.config = config;
  }

  /**
   * Hash a password with optional pepper
   * @param password The password to hash
   * @returns The hashed password
   */
  static async hash(password: string): Promise<string> {
    // Validate password length to prevent DoS
    if (
      password.length > (this.config?.maxLength || this.MAX_PASSWORD_LENGTH)
    ) {
      throw new PasswordError(
        "Password exceeds maximum length",
        "PASSWORD_TOO_LONG"
      );
    }

    // Apply pepper if configured (pre-hash secret)
    const pepperedPassword = this.applyPepper(password);

    // Use configured salt rounds or default
    const saltRounds = this.config?.saltRounds || this.DEFAULT_SALT_ROUNDS;

    // Bcrypt has a 72-byte limit, so we hash long passwords first
    const passwordToHash =
      pepperedPassword.length > 72
        ? this.preHash(pepperedPassword)
        : pepperedPassword;

    return bcrypt.hash(passwordToHash, saltRounds);
  }

  /**
   * Verify a password against a hash using timing-safe comparison
   * @param password The plain text password
   * @param hash The hashed password
   * @returns True if the password matches the hash
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    // Validate inputs
    if (!password || !hash) {
      // Still perform a dummy comparison to prevent timing attacks
      await bcrypt.compare("dummy", "$2a$12$dummy.hash.for.timing.safety");
      return false;
    }

    // Validate password length
    if (
      password.length > (this.config?.maxLength || this.MAX_PASSWORD_LENGTH)
    ) {
      await bcrypt.compare("dummy", "$2a$12$dummy.hash.for.timing.safety");
      return false;
    }

    // Apply pepper if configured
    const pepperedPassword = this.applyPepper(password);

    // Handle bcrypt's 72-byte limit
    const passwordToVerify =
      pepperedPassword.length > 72
        ? this.preHash(pepperedPassword)
        : pepperedPassword;

    return bcrypt.compare(passwordToVerify, hash);
  }

  /**
   * Validate password strength according to configuration
   * @param password The password to validate
   * @returns Validation result with score and feedback
   */
  static validateStrength(password: string): PasswordStrengthResult {
    const errors: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    const minLength = this.config?.minLength || this.MIN_PASSWORD_LENGTH;
    const maxLength = this.config?.maxLength || this.MAX_PASSWORD_LENGTH;

    // Length checks
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters`);
    } else {
      score += Math.min(25, password.length * 2);
    }

    if (password.length > maxLength) {
      errors.push(`Password must not exceed ${maxLength} characters`);
    }

    // Character type checks
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    );

    if (this.config?.requireUppercase !== false) {
      if (hasUppercase) {
        score += 15;
      } else if (this.config?.requireUppercase) {
        errors.push("Password must contain at least one uppercase letter");
      } else {
        suggestions.push("Add uppercase letters for stronger security");
      }
    }

    if (this.config?.requireLowercase !== false) {
      if (hasLowercase) {
        score += 15;
      } else if (this.config?.requireLowercase) {
        errors.push("Password must contain at least one lowercase letter");
      } else {
        suggestions.push("Add lowercase letters for stronger security");
      }
    }

    if (this.config?.requireNumbers !== false) {
      if (hasNumbers) {
        score += 15;
      } else if (this.config?.requireNumbers) {
        errors.push("Password must contain at least one number");
      } else {
        suggestions.push("Add numbers for stronger security");
      }
    }

    if (this.config?.requireSpecialChars !== false) {
      if (hasSpecialChars) {
        score += 20;
      } else if (this.config?.requireSpecialChars) {
        errors.push("Password must contain at least one special character");
      } else {
        suggestions.push(
          "Add special characters (!@#$%^&*) for stronger security"
        );
      }
    }

    // Check for common patterns
    if (this.hasCommonPatterns(password)) {
      score -= 20;
      suggestions.push(
        "Avoid common patterns like '123', 'abc', or keyboard sequences"
      );
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      suggestions.push("Avoid repeated characters");
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      score,
      errors,
      suggestions,
    };
  }

  /**
   * Check if password contains common weak patterns
   */
  private static hasCommonPatterns(password: string): boolean {
    const commonPatterns = [
      /123456/i,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /letmein/i,
      /welcome/i,
      /admin/i,
      /login/i,
      /master/i,
      /111111/,
      /000000/,
      /123123/,
      /12345678/,
      /1234567890/,
      /abcdef/i,
      /qwertyuiop/i,
      /asdfghjkl/i,
      /zxcvbnm/i,
    ];

    const lowerPassword = password.toLowerCase();
    return commonPatterns.some((pattern) => pattern.test(lowerPassword));
  }

  /**
   * Apply pepper to password (server-side secret)
   */
  private static applyPepper(password: string): string {
    if (!this.config?.pepper) {
      return password;
    }
    // Use HMAC to combine password with pepper
    return crypto
      .createHmac("sha256", this.config.pepper)
      .update(password)
      .digest("hex");
  }

  /**
   * Pre-hash long passwords to handle bcrypt's 72-byte limit
   */
  private static preHash(password: string): string {
    return crypto.createHash("sha256").update(password).digest("base64");
  }

  /**
   * Generate a cryptographically secure random password
   * @param length Password length (default: 16)
   * @param options Character set options
   */
  static generateSecurePassword(
    length: number = 16,
    options?: {
      includeUppercase?: boolean;
      includeLowercase?: boolean;
      includeNumbers?: boolean;
      includeSpecialChars?: boolean;
    }
  ): string {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
    };
    const opts = { ...defaults, ...options };

    let charset = "";
    if (opts.includeLowercase) charset += "abcdefghijklmnopqrstuvwxyz";
    if (opts.includeUppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (opts.includeNumbers) charset += "0123456789";
    if (opts.includeSpecialChars) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    if (!charset) {
      throw new PasswordError(
        "At least one character set must be enabled",
        "INVALID_OPTIONS"
      );
    }

    const randomBytes = crypto.randomBytes(length);
    let password = "";

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }

  /**
   * Check if a hash needs to be rehashed (e.g., after config change)
   */
  static needsRehash(hash: string): boolean {
    const saltRounds = this.config?.saltRounds || this.DEFAULT_SALT_ROUNDS;

    // Extract rounds from bcrypt hash
    const match = hash.match(/^\$2[aby]?\$(\d+)\$/);
    if (!match) return true;

    const hashRounds = parseInt(match[1], 10);
    return hashRounds < saltRounds;
  }

  /**
   * Calculate password entropy (bits of randomness)
   */
  static calculateEntropy(password: string): number {
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

    if (charsetSize === 0) return 0;
    return Math.floor(password.length * Math.log2(charsetSize));
  }
}

/**
 * Custom Password Error class
 */
export class PasswordError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PasswordError";
    this.code = code;
  }
}
