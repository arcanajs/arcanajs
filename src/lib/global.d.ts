// ============================================================================
// Express Augmentation
// ============================================================================
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module "*.css";

declare global {
  var __non_webpack_require__: NodeJS.Require;
  namespace Express {
    interface Request {
      /**
       * Normalized DB object optionally attached to the request by ArcanaJSServer.
       * It may be either the raw client, or an object like `{ client, db, close }`.
       */
      db?: any;
    }
    interface Response {
      /**
       * Render a page component with data
       * @param page - Name of the page component to render
       * @param data - Data to pass to the page component
       */
      renderPage(page: string, data?: any): void;

      /**
       * Send a success JSON response
       * @param data - Data to send in the response
       * @param message - Optional success message
       * @param status - HTTP status code (default: 200)
       */
      success(
        data?: string | object | null,
        message?: string,
        status?: number
      ): Response;

      /**
       * Send an error JSON response
       * @param message - Error message
       * @param status - HTTP status code (default: 500)
       * @param error - Error details
       * @param data - Additional error data
       */
      error(
        message?: string,
        status?: number,
        error?: string | object | null,
        data?: string | object | null
      ): Response;
    }
  }

  // ============================================================================
  // CSS Module Declarations
  // ============================================================================
}

export {};
