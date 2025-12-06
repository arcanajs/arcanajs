import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Response {
    /**
     * Sends a success response with a standard format.
     *
     * @param data - The data payload to include in the response (default: {}).
     * @param message - A descriptive message for the success (default: "Success").
     * @param status - The HTTP status code to return (default: 200).
     * @returns The Express Response object.
     */
    success(
      data?: string | object | null,
      message?: string,
      status?: number
    ): this;

    /**
     * Sends an error response with a standard format.
     *
     * @param message - A descriptive message for the error (default: "Error").
     * @param status - The HTTP status code to return (default: 500).
     * @param error - Additional error details or object (default: null).
     * @param data - Optional data payload to include in the error response (default: null).
     * @returns The Express Response object.
     */
    error(
      message?: string,
      status?: number,
      error?: string | object | null | undefined | unknown,
      data?: string | object | null
    ): this;

    /**
     * Renders a React page using ArcanaJS SSR.
     *
     * @param page - The name of the page component to render.
     * @param data - Initial data to pass to the page component (default: {}).
     * @param params - Route parameters (default: {}).
     * @returns The Express Response object.
     */
    renderPage(page: string, data?: any, params?: Record<string, string>): this;
  }
}
