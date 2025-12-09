// ============================================================================
// Authentication Exports
// ============================================================================

// Core Services
export { AuthProvider } from "./auth/AuthProvider";
export { JWTError, JWTService } from "./auth/JWTService";
export { SessionError, SessionManager } from "./auth/SessionManager";

// Middleware
export {
  authenticated,
  AuthenticatedMiddleware,
} from "./auth/middleware/AuthenticatedMiddleware";
export { AuthMiddleware } from "./auth/middleware/AuthMiddleware";
export { guest, GuestMiddleware } from "./auth/middleware/GuestMiddleware";
export {
  authorize,
  hasAllRoles,
  hasPermission,
  hasRole,
  RoleMiddleware,
  Roles,
} from "./auth/middleware/RoleMiddleware";

// Utilities
export {
  PasswordError,
  PasswordHasher,
  type PasswordStrengthResult,
} from "./auth/utils/PasswordHasher";
export {
  RateLimiter,
  RateLimiters,
  type RateLimitConfig,
} from "./auth/utils/RateLimiter";
export {
  AuditLogger,
  IPValidator,
  SecurityHeaders,
  SecurityUtils,
  type AuditEvent,
  type CSPDirectives,
  type SecurityHeaderOptions,
} from "./auth/utils/SecurityUtils";
export { TokenBlacklist } from "./auth/utils/TokenBlacklist";

// Types
export type {
  AuthConfig,
  AuthErrorCode,
  AuthResult,
  DecodedToken,
  JWTPayload,
  TokenPair,
} from "./auth/types";
