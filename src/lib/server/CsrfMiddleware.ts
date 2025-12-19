import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

const CSRF_COOKIE_NAME = "_csrf";

/**
 * Timing-safe CSRF token comparison to prevent timing attacks
 * This ensures that token validation takes constant time regardless of where
 * the tokens differ, preventing attackers from using timing analysis to
 * guess valid tokens character by character.
 */
function isValidCsrfToken(providedToken: string, expectedToken: string): boolean {
  // Ensure both tokens are the same length to prevent timing attacks
  // If lengths differ, we still perform a comparison to maintain constant time
  if (providedToken.length !== expectedToken.length) {
    // Create a dummy token of the same length as expected for constant-time comparison
    const dummyToken = "0".repeat(expectedToken.length);
    crypto.timingSafeEqual(
      Buffer.from(dummyToken),
      Buffer.from(expectedToken)
    );
    return false;
  }

  try {
    // Perform constant-time comparison of the tokens
    return crypto.timingSafeEqual(
      Buffer.from(providedToken),
      Buffer.from(expectedToken)
    );
  } catch (error) {
    // If buffer conversion fails, tokens are invalid
    return false;
  }
}

export const createCsrfMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Generate or retrieve token
    let token = req.cookies[CSRF_COOKIE_NAME];

    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }

    // 2. Expose token to the response locals (for injection into the view)
    res.locals.csrfToken = token;

    // 3. Verify token on state-changing methods
    const method = req.method.toUpperCase();
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const headerToken = req.headers["x-csrf-token"];

      // Validate token exists and is a string
      if (!headerToken || typeof headerToken !== "string") {
        return res.status(403).json({ error: "Invalid CSRF Token" });
      }

      // Use timing-safe comparison to prevent timing attacks
      if (!isValidCsrfToken(headerToken, token)) {
        return res.status(403).json({ error: "Invalid CSRF Token" });
      }
    }

    next();
  };
};
