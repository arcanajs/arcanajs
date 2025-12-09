import { Express } from "express";
import http from "http";

export interface LifecycleHandlers {
  onShutdown: () => Promise<void>;
}

/**
 * Manages server lifecycle (start, stop, signal handling)
 */
export class ServerLifecycle {
  private app: Express;
  private serverInstance?: http.Server;
  private isShuttingDown = false;
  private autoHandleSignals: boolean;
  private handlers: LifecycleHandlers;

  private _sigintHandler?: () => void;
  private _sigtermHandler?: () => void;

  constructor(
    app: Express,
    autoHandleSignals: boolean,
    handlers: LifecycleHandlers
  ) {
    this.app = app;
    this.autoHandleSignals = autoHandleSignals;
    this.handlers = handlers;
  }

  /**
   * Start the HTTP server
   */
  public async start(port: number | string): Promise<void> {
    if (this.serverInstance) {
      console.warn(
        "Server is already running. Call stop() before starting again."
      );
      return;
    }

    this.serverInstance = this.app.listen(port, () => {
      console.log(`✓ Server is running on http://localhost:${port}`);
    });

    this.setupServerErrorHandler(port);

    if (this.autoHandleSignals) {
      this.setupSignalHandlers();
    }
  }

  /**
   * Setup server error handler
   */
  private setupServerErrorHandler(port: number | string): void {
    this.serverInstance!.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`✗ Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error("✗ Server error:", error);
      }
    });
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`\n⚠ Received ${signal}, shutting down gracefully...`);

      // Force exit after 5s if graceful shutdown hangs (reduced from 10s for dev mode)
      const forceExit = setTimeout(() => {
        console.error("✗ Shutdown timed out, forcing exit");
        process.exit(1);
      }, 5000);
      forceExit.unref();

      try {
        await this.stop();
        clearTimeout(forceExit);
        console.log("✓ Shutdown complete");
        process.exit(0);
      } catch (err) {
        clearTimeout(forceExit);
        console.error("✗ Error during shutdown:", err);
        process.exit(1);
      }
    };

    this._sigintHandler = () => shutdown("SIGINT");
    this._sigtermHandler = () => shutdown("SIGTERM");

    process.on("SIGINT", this._sigintHandler);
    process.on("SIGTERM", this._sigtermHandler);

    console.log("✓ Signal handlers registered (Ctrl+C to stop)");
  }

  /**
   * Stop the HTTP server
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown && !this.serverInstance) return;
    this.isShuttingDown = true;

    // Close HTTP server
    if (this.serverInstance) {
      console.log("⏳ Stopping HTTP server...");
      await new Promise<void>((resolve, reject) => {
        this.serverInstance!.close((err) => {
          if (err) {
            console.error("✗ Error closing HTTP server:", err);
            return reject(err);
          }
          resolve();
        });
      });
      this.serverInstance = undefined;
      console.log("✓ HTTP server stopped");
    } else {
      console.log("ℹ HTTP server is not running");
    }

    // Call shutdown handler for providers, etc.
    await this.handlers.onShutdown();

    // Remove signal handlers
    this.removeSignalHandlers();
  }

  /**
   * Remove registered signal handlers
   */
  private removeSignalHandlers(): void {
    try {
      if (this._sigintHandler) {
        process.removeListener("SIGINT", this._sigintHandler);
        this._sigintHandler = undefined;
      }
      if (this._sigtermHandler) {
        process.removeListener("SIGTERM", this._sigtermHandler);
        this._sigtermHandler = undefined;
      }
    } catch (err) {
      // Ignore errors while removing listeners
    }
  }

  /**
   * Check if server is currently running
   */
  public isRunning(): boolean {
    return !!this.serverInstance;
  }

  /**
   * Get the HTTP server instance
   */
  public getServerInstance(): http.Server | undefined {
    return this.serverInstance;
  }
}
