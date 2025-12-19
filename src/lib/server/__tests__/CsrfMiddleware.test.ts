import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { createCsrfMiddleware } from "../CsrfMiddleware";

// Mock Express types
type MockRequest = Partial<Request> & {
  cookies: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  method: string;
};

type MockResponse = Partial<Response> & {
  locals: Record<string, any>;
  cookie: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
};

describe("CSRF Middleware Security Tests", () => {
  let mockReq: MockRequest;
  let mockRes: MockResponse;
  let mockNext: jest.Mock<NextFunction>;
  let csrfMiddleware: ReturnType<typeof createCsrfMiddleware>;

  beforeEach(() => {
    // Reset mocks before each test
    mockReq = {
      cookies: {},
      headers: {},
      method: "GET",
    };

    mockRes = {
      locals: {},
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
    csrfMiddleware = createCsrfMiddleware();
  });

  describe("Token Generation", () => {
    it("should generate a new CSRF token if none exists", () => {
      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "_csrf",
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
        })
      );
      expect(mockRes.locals.csrfToken).toBeDefined();
      expect(typeof mockRes.locals.csrfToken).toBe("string");
      expect(mockRes.locals.csrfToken.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it("should reuse existing CSRF token from cookie", () => {
      const existingToken = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = existingToken;

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockRes.locals.csrfToken).toBe(existingToken);
    });

    it("should set secure flag in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "_csrf",
        expect.any(String),
        expect.objectContaining({
          secure: true,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Safe Methods (GET, HEAD, OPTIONS)", () => {
    it("should allow GET requests without token validation", () => {
      mockReq.method = "GET";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow HEAD requests without token validation", () => {
      mockReq.method = "HEAD";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow OPTIONS requests without token validation", () => {
      mockReq.method = "OPTIONS";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("State-Changing Methods (POST, PUT, DELETE, PATCH)", () => {
    const statefulMethods = ["POST", "PUT", "DELETE", "PATCH"];

    statefulMethods.forEach((method) => {
      describe(`${method} requests`, () => {
        beforeEach(() => {
          mockReq.method = method;
        });

        it("should reject request with missing CSRF token", () => {
          const token = crypto.randomBytes(32).toString("hex");
          mockReq.cookies["_csrf"] = token;

          csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

          expect(mockRes.status).toHaveBeenCalledWith(403);
          expect(mockRes.json).toHaveBeenCalledWith({
            error: "Invalid CSRF Token",
          });
          expect(mockNext).not.toHaveBeenCalled();
        });

        it("should reject request with invalid CSRF token", () => {
          const validToken = crypto.randomBytes(32).toString("hex");
          const invalidToken = crypto.randomBytes(32).toString("hex");

          mockReq.cookies["_csrf"] = validToken;
          mockReq.headers["x-csrf-token"] = invalidToken;

          csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

          expect(mockRes.status).toHaveBeenCalledWith(403);
          expect(mockRes.json).toHaveBeenCalledWith({
            error: "Invalid CSRF Token",
          });
          expect(mockNext).not.toHaveBeenCalled();
        });

        it("should accept request with valid CSRF token", () => {
          const token = crypto.randomBytes(32).toString("hex");
          mockReq.cookies["_csrf"] = token;
          mockReq.headers["x-csrf-token"] = token;

          csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe("Timing Attack Protection", () => {
    it("should use constant-time comparison for token validation", () => {
      const validToken = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = validToken;
      mockReq.method = "POST";

      // Test with tokens that differ at different positions
      const testTokens = [
        validToken.slice(0, -1) + "0", // Differ at last char
        "0" + validToken.slice(1), // Differ at first char
        validToken.slice(0, 32) + "0".repeat(32), // Differ in middle
      ];

      testTokens.forEach((testToken) => {
        // Reset mocks for each iteration
        mockRes = {
          locals: {},
          cookie: jest.fn(),
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        mockReq.headers["x-csrf-token"] = testToken;

        const startTime = process.hrtime.bigint();
        csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);
        const endTime = process.hrtime.bigint();

        // Verify rejection happened
        expect(mockRes.status).toHaveBeenCalledWith(403);

        // Note: We can't reliably test timing in unit tests, but we can verify
        // the function completes and rejects all invalid tokens
      });
    });

    it("should handle tokens of different lengths securely", () => {
      const validToken = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = validToken;
      mockReq.method = "POST";

      // Test with various length tokens
      const invalidLengthTokens = [
        validToken.slice(0, 10), // Too short
        validToken + "extra", // Too long
        "", // Empty
      ];

      invalidLengthTokens.forEach((token) => {
        mockRes.status = jest.fn().mockReturnThis();
        mockRes.json = jest.fn().mockReturnThis();
        mockNext = jest.fn();
        mockReq.headers["x-csrf-token"] = token;

        csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe("Type Safety", () => {
    beforeEach(() => {
      mockReq.method = "POST";
      const validToken = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = validToken;
    });

    it("should reject non-string token headers", () => {
      // Test with array (Express can provide arrays for duplicate headers)
      mockReq.headers["x-csrf-token"] = ["token1", "token2"] as any;

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject undefined token headers", () => {
      mockReq.headers["x-csrf-token"] = undefined;

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject null token headers", () => {
      mockReq.headers["x-csrf-token"] = null as any;

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject numeric token headers", () => {
      mockReq.headers["x-csrf-token"] = 12345 as any;

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle multiple requests with same token", () => {
      const token = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = token;
      mockReq.method = "POST";
      mockReq.headers["x-csrf-token"] = token;

      // First request
      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request with same token
      mockNext = jest.fn();
      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should expose token to response locals for rendering", () => {
      const token = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = token;

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.locals.csrfToken).toBe(token);
    });

    it("should handle case-insensitive method names", () => {
      const token = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = token;
      mockReq.headers["x-csrf-token"] = token;

      // Test with lowercase method
      mockReq.method = "post";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed tokens gracefully", () => {
      const validToken = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = validToken;
      mockReq.method = "POST";
      mockReq.headers["x-csrf-token"] = "not-a-valid-hex-token!@#$%";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle unicode characters in token", () => {
      const validToken = crypto.randomBytes(32).toString("hex");
      mockReq.cookies["_csrf"] = validToken;
      mockReq.method = "POST";
      mockReq.headers["x-csrf-token"] = "token-with-unicode-🔒";

      csrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
