import crypto from "crypto";
import jwt, { Algorithm, SignOptions, VerifyOptions } from "jsonwebtoken";
import { AuthConfig, DecodedToken, JWTPayload, TokenPair } from "./types";
import { TokenBlacklist } from "./utils/TokenBlacklist";

/**
 * JWT Service for secure token generation and verification
 * Implements best practices for JWT security
 */
export class JWTService {
  private static config: AuthConfig["jwt"];
  private static readonly NEAR_EXPIRY_THRESHOLD = 5 * 60; // 5 minutes

  /**
   * Initialize JWT service with configuration
   */
  static init(config: AuthConfig["jwt"]) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Validate JWT configuration for security requirements
   */
  private static validateConfig(config: AuthConfig["jwt"]) {
    if (!config.secret && !config.privateKey) {
      throw new Error("JWT secret or private key is required");
    }

    const algorithm = config.algorithm || "HS256";

    // Validate secret length for HMAC algorithms
    if (algorithm.startsWith("HS")) {
      const minSecretLength =
        algorithm === "HS256" ? 32 : algorithm === "HS384" ? 48 : 64;
      if (config.secret && config.secret.length < minSecretLength) {
        console.warn(
          `⚠️ JWT secret should be at least ${minSecretLength} characters for ${algorithm}`
        );
      }
    }

    // Validate RSA keys for RS algorithms
    if (algorithm.startsWith("RS")) {
      if (!config.privateKey || !config.publicKey) {
        throw new Error(
          `RSA private and public keys required for ${algorithm}`
        );
      }
    }
  }

  /**
   * Generate a cryptographically secure JWT ID
   */
  private static generateJTI(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate a token family ID for refresh token rotation
   */
  private static generateTokenFamily(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Create a fingerprint hash from client data
   */
  static createFingerprint(userAgent: string, ip: string): string {
    const data = `${userAgent}|${ip}`;
    return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  }

  /**
   * Hash an IP address for storage in token
   */
  static hashIP(ip: string): string {
    return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
  }

  /**
   * Get the signing key based on algorithm
   */
  private static getSigningKey(): string | Buffer {
    const algorithm = this.config.algorithm || "HS256";
    if (algorithm.startsWith("RS")) {
      return this.config.privateKey!;
    }
    return this.config.secret;
  }

  /**
   * Get the verification key based on algorithm
   */
  private static getVerificationKey(): string | Buffer {
    const algorithm = this.config.algorithm || "HS256";
    if (algorithm.startsWith("RS")) {
      return this.config.publicKey!;
    }
    return this.config.secret;
  }

  /**
   * Generate an access token with enhanced security claims
   */
  static generateToken(
    payload: JWTPayload,
    options?: SignOptions & { fingerprint?: string; sessionId?: string }
  ): string {
    const jti = this.generateJTI();
    const algorithm = (this.config.algorithm || "HS256") as Algorithm;

    const tokenPayload: JWTPayload = {
      ...payload,
      jti,
      type: "access",
      iss: this.config.issuer,
      aud: this.config.audience,
    };

    // Add fingerprint if enabled
    if (this.config.enableFingerprint && options?.fingerprint) {
      tokenPayload.fingerprint = options.fingerprint;
    }

    // Add session binding
    if (options?.sessionId) {
      tokenPayload.sid = options.sessionId;
    }

    const signOptions: SignOptions = {
      expiresIn: (this.config.accessTokenExpiry || "15m") as any,
      algorithm,
      ...options,
    };

    // Remove custom options not recognized by jwt.sign
    delete (signOptions as any).fingerprint;
    delete (signOptions as any).sessionId;

    return jwt.sign(tokenPayload, this.getSigningKey(), signOptions);
  }

  /**
   * Generate a refresh token with token family for rotation detection
   */
  static generateRefreshToken(
    payload: JWTPayload,
    tokenFamily?: string
  ): string {
    const jti = this.generateJTI();
    const family = tokenFamily || this.generateTokenFamily();
    const algorithm = (this.config.algorithm || "HS256") as Algorithm;

    const tokenPayload: JWTPayload = {
      sub: payload.sub,
      jti,
      type: "refresh",
      tokenFamily: family,
      iss: this.config.issuer,
      aud: this.config.audience,
      tokenVersion: payload.tokenVersion,
    };

    return jwt.sign(tokenPayload, this.getSigningKey(), {
      expiresIn: (this.config.refreshTokenExpiry || "7d") as any,
      algorithm,
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(
    payload: JWTPayload,
    options?: { fingerprint?: string; sessionId?: string }
  ): TokenPair {
    const tokenFamily = this.generateTokenFamily();
    const accessToken = this.generateToken(payload, options);
    const refreshToken = this.generateRefreshToken(payload, tokenFamily);

    const decoded = jwt.decode(accessToken) as JWTPayload;

    return {
      accessToken,
      refreshToken,
      expiresAt: decoded.exp! * 1000,
      tokenType: "Bearer",
    };
  }

  /**
   * Verify a token with comprehensive security checks
   */
  static async verifyToken(
    token: string,
    options?: VerifyOptions & {
      fingerprint?: string;
      validateFingerprint?: boolean;
    }
  ): Promise<DecodedToken> {
    // Check if token is blacklisted
    if (await TokenBlacklist.isRevoked(token)) {
      throw new JWTError("Token has been revoked", "TOKEN_REVOKED");
    }

    const algorithm = (this.config.algorithm || "HS256") as Algorithm;

    const verifyOptions: VerifyOptions = {
      algorithms: [algorithm],
      issuer: this.config.issuer,
      audience: this.config.audience,
      ...options,
    };

    // Remove custom options
    delete (verifyOptions as any).fingerprint;
    delete (verifyOptions as any).validateFingerprint;

    let payload: JWTPayload;
    try {
      payload = jwt.verify(
        token,
        this.getVerificationKey(),
        verifyOptions
      ) as JWTPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new JWTError("Token has expired", "TOKEN_EXPIRED");
      }
      if (err.name === "JsonWebTokenError") {
        throw new JWTError("Token is invalid", "TOKEN_INVALID");
      }
      if (err.name === "NotBeforeError") {
        throw new JWTError("Token not yet valid", "TOKEN_NOT_ACTIVE");
      }
      throw new JWTError("Token verification failed", "TOKEN_INVALID");
    }

    // Validate fingerprint if enabled and provided
    if (
      this.config.enableFingerprint &&
      options?.validateFingerprint &&
      options?.fingerprint
    ) {
      if (
        !this.timingSafeEqual(payload.fingerprint || "", options.fingerprint)
      ) {
        throw new JWTError(
          "Token fingerprint mismatch",
          "FINGERPRINT_MISMATCH"
        );
      }
    }

    // Calculate remaining time and near-expiry status
    const now = Math.floor(Date.now() / 1000);
    const remainingTime = (payload.exp || 0) - now;
    const isNearExpiry = remainingTime <= this.NEAR_EXPIRY_THRESHOLD;

    return {
      ...payload,
      rawToken: token,
      isNearExpiry,
      remainingTime,
    };
  }

  /**
   * Decode a token without verification (use with caution)
   */
  static decodeToken(token: string): JWTPayload | null {
    return jwt.decode(token) as JWTPayload | null;
  }

  /**
   * Revoke a token by adding it to the blacklist
   */
  static async revokeToken(token: string): Promise<void> {
    const decoded = jwt.decode(token) as JWTPayload;
    if (decoded && decoded.exp) {
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await TokenBlacklist.add(token, expiresIn, decoded.jti);
      }
    }
  }

  /**
   * Revoke all tokens in a token family (for refresh token rotation)
   */
  static async revokeTokenFamily(tokenFamily: string): Promise<void> {
    await TokenBlacklist.revokeFamily(tokenFamily);
  }

  /**
   * Refresh an access token using a valid refresh token
   * Implements refresh token rotation for enhanced security
   */
  static async refreshAccessToken(
    refreshToken: string,
    options?: {
      fingerprint?: string;
      sessionId?: string;
      rotateRefresh?: boolean;
    }
  ): Promise<TokenPair> {
    const payload = await this.verifyToken(refreshToken);

    if (payload.type !== "refresh") {
      throw new JWTError("Invalid token type", "INVALID_TOKEN_TYPE");
    }

    // Check if token family has been compromised
    if (payload.tokenFamily) {
      const isCompromised = await TokenBlacklist.isFamilyRevoked(
        payload.tokenFamily
      );
      if (isCompromised) {
        throw new JWTError(
          "Token family has been revoked",
          "TOKEN_FAMILY_REVOKED"
        );
      }
    }

    // Revoke the old refresh token (refresh token rotation)
    await this.revokeToken(refreshToken);

    // Extract user data for new tokens
    const { exp, iat, type, jti, tokenFamily, ...userData } = payload;

    // Generate new token pair with the same family (or new family if rotating)
    const newFamily = options?.rotateRefresh ? undefined : tokenFamily;
    const accessToken = this.generateToken(userData as JWTPayload, {
      fingerprint: options?.fingerprint,
      sessionId: options?.sessionId,
    });
    const newRefreshToken = this.generateRefreshToken(
      userData as JWTPayload,
      newFamily
    );

    const decoded = jwt.decode(accessToken) as JWTPayload;

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: decoded.exp! * 1000,
      tokenType: "Bearer",
    };
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still compare to prevent timing leaks
      crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Check if a token is about to expire
   */
  static isTokenNearExpiry(token: string, thresholdSeconds?: number): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const threshold = thresholdSeconds || this.NEAR_EXPIRY_THRESHOLD;
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now <= threshold;
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return null;
    return new Date(decoded.exp * 1000);
  }
}

/**
 * Custom JWT Error class with error codes
 */
export class JWTError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "JWTError";
    this.code = code;
  }
}
