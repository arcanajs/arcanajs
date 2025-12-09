import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";
import { AuthErrorCode } from "../types";

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access based on user roles with support for:
 * - Multiple required roles (all must match)
 * - Any role matching (at least one must match)
 * - Permission-based checks
 * - Hierarchical roles
 */
export class RoleMiddleware implements Middleware {
  private roles: string[];
  private mode: "all" | "any";
  private permissions: string[];

  /**
   * Create role middleware
   * @param roles Required roles
   * @param options Configuration options
   */
  constructor(
    roles: string | string[],
    options?: {
      mode?: "all" | "any";
      permissions?: string[];
    }
  ) {
    this.roles = Array.isArray(roles) ? roles : [roles];
    this.mode = options?.mode || "any";
    this.permissions = options?.permissions || [];
  }

  handle(req: Request, res: Response, next: NextFunction) {
    // Check authentication first
    if (!req.user) {
      return this.sendError(
        res,
        401,
        "Authentication required",
        AuthErrorCode.INVALID_CREDENTIALS
      );
    }

    // Check roles
    const userRoles = req.user.roles || [];
    const hasRequiredRoles = this.checkRoles(userRoles);

    // Check permissions if specified
    const userPermissions = req.user.permissions || [];
    const hasRequiredPermissions = this.checkPermissions(userPermissions);

    if (!hasRequiredRoles) {
      return this.sendError(
        res,
        403,
        "Insufficient role privileges",
        AuthErrorCode.INSUFFICIENT_PERMISSIONS
      );
    }

    if (this.permissions.length > 0 && !hasRequiredPermissions) {
      return this.sendError(
        res,
        403,
        "Insufficient permissions",
        AuthErrorCode.INSUFFICIENT_PERMISSIONS
      );
    }

    next();
  }

  /**
   * Check if user has required roles
   */
  private checkRoles(userRoles: string[]): boolean {
    if (this.roles.length === 0) return true;

    if (this.mode === "all") {
      return this.roles.every((role) => userRoles.includes(role));
    }

    return this.roles.some((role) => userRoles.includes(role));
  }

  /**
   * Check if user has required permissions
   */
  private checkPermissions(userPermissions: string[]): boolean {
    if (this.permissions.length === 0) return true;

    // Support wildcard permissions (e.g., "posts:*" matches "posts:read", "posts:write")
    return this.permissions.every((requiredPerm) => {
      return userPermissions.some((userPerm) => {
        if (userPerm === "*") return true; // Super admin
        if (userPerm === requiredPerm) return true;

        // Check wildcard match (e.g., "posts:*" matches "posts:read")
        if (userPerm.endsWith(":*")) {
          const prefix = userPerm.slice(0, -1);
          return requiredPerm.startsWith(prefix);
        }

        return false;
      });
    });
  }

  /**
   * Send error response
   */
  private sendError(
    res: Response,
    status: number,
    message: string,
    code: AuthErrorCode
  ): void {
    res.status(status).json({
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Factory function to create RoleMiddleware for specific roles
 */
export function hasRole(...roles: string[]): RoleMiddleware {
  return new RoleMiddleware(roles, { mode: "any" });
}

/**
 * Factory function requiring ALL specified roles
 */
export function hasAllRoles(...roles: string[]): RoleMiddleware {
  return new RoleMiddleware(roles, { mode: "all" });
}

/**
 * Factory function for permission-based access
 */
export function hasPermission(...permissions: string[]): RoleMiddleware {
  return new RoleMiddleware([], { permissions });
}

/**
 * Factory function combining roles and permissions
 */
export function authorize(options: {
  roles?: string[];
  permissions?: string[];
  mode?: "all" | "any";
}): RoleMiddleware {
  return new RoleMiddleware(options.roles || [], {
    mode: options.mode,
    permissions: options.permissions,
  });
}

/**
 * Common role presets
 */
export const Roles = {
  Admin: new RoleMiddleware(["admin"]),
  Moderator: new RoleMiddleware(["admin", "moderator"]),
  User: new RoleMiddleware(["admin", "moderator", "user"]),
  SuperAdmin: new RoleMiddleware(["super_admin"]),
};
