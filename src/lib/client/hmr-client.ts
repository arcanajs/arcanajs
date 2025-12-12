/**
 * ArcanaJS Hot Module Replacement (HMR) Client
 *
 * Professional HMR client with auto-reconnect, error handling,
 * heartbeat support, CSS hot reload, and graceful degradation.
 */

interface HMRMessage {
  type: "reload" | "error" | "connected" | "building" | "css-update";
  message?: string;
  target?: "client" | "server";
  status?: "building" | "done";
  timestamp?: number;
}

class HMRClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;
  private lastReloadTimestamp = 0;
  private pendingReload = false;
  private buildingTargets = new Set<string>();

  constructor(private port: number) {
    this.connect();
    this.setupBeforeUnload();
    this.setupVisibilityChange();
  }

  private connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      this.socket = new WebSocket(`${protocol}//${host}:${this.port}`);

      this.socket.onopen = () => {
        console.log("[HMR] Connected to development server");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.showConnectionStatus("connected");

        // Process pending reload if any
        if (this.pendingReload) {
          this.pendingReload = false;
          window.location.reload();
        }
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.socket.onerror = () => {
        // Error will trigger onclose, no need to log here
      };

      this.socket.onclose = () => {
        if (!this.isIntentionallyClosed) {
          this.showConnectionStatus("disconnected");
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[HMR] Failed to create WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: HMRMessage = JSON.parse(event.data);

      switch (message.type) {
        case "reload":
          // Debounce reloads - ignore if we just reloaded
          const now = Date.now();
          if (
            message.timestamp &&
            message.timestamp <= this.lastReloadTimestamp
          ) {
            return;
          }
          this.lastReloadTimestamp = now;

          // Don't reload while still building
          if (this.buildingTargets.size > 0) {
            console.log("[HMR] Build in progress, reload pending...");
            this.pendingReload = true;
            return;
          }

          console.log("[HMR] Reloading page...");
          this.showConnectionStatus("reloading");
          window.location.reload();
          break;

        case "css-update":
          // CSS-only update - no full page reload needed
          console.log("[HMR] 🎨 CSS updated (no reload)");
          this.showConnectionStatus("css-update");
          this.updateCSS();
          break;

        case "building":
          if (message.target) {
            if (message.status === "building") {
              this.buildingTargets.add(message.target);
            } else {
              this.buildingTargets.delete(message.target);
            }
          }
          console.log(`[HMR] ${message.target || "Server"} is rebuilding...`);
          this.showConnectionStatus("building");
          break;

        case "connected":
          console.log("[HMR] Server acknowledged connection");
          break;

        case "error":
          console.error("[HMR] Server error:", message.message);
          break;

        default:
          // Unknown message type - ignore silently
          break;
      }
    } catch (error) {
      console.error("[HMR] Failed to parse message:", error);
    }
  }

  /**
   * Update CSS without full page reload
   * Forces style-loader to re-inject all styles
   */
  private updateCSS(): void {
    // Find all style tags injected by style-loader
    const styleElements = document.querySelectorAll(
      'style[data-webpack], link[rel="stylesheet"]'
    );

    // For style tags (style-loader in dev mode)
    // The styles will be automatically updated by webpack's HMR
    // We just need to trigger a re-render by forcing style recalculation

    // Force style recalculation on the document
    const body = document.body;
    if (body) {
      // Toggle a class to force style recalculation
      body.classList.add("__arcanajs-hmr-update");
      // Use requestAnimationFrame to ensure the class is applied
      requestAnimationFrame(() => {
        body.classList.remove("__arcanajs-hmr-update");
      });
    }

    // For link tags, we can force reload by updating the href
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        // Use URL parsing to properly check the hostname instead of substring matching
        // This prevents bypass attempts like "fonts.googleapis.com.evil.com"
        try {
          const url = new URL(href, window.location.origin);
          if (url.hostname === "fonts.googleapis.com") {
            return; // Skip Google Fonts stylesheets
          }
        } catch {
          // If URL parsing fails, it's likely a relative URL which is safe to reload
        }
        // Add timestamp to bust cache
        const newHref = href.replace(/(\?|&)_hmr=\d+/, "");
        link.setAttribute(
          "href",
          `${newHref}${newHref.includes("?") ? "&" : "?"}_hmr=${Date.now()}`
        );
      }
    });

    // Dispatch event for custom handling
    window.dispatchEvent(
      new CustomEvent("arcanajs-css-update", {
        detail: { timestamp: Date.now() },
      })
    );
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "[HMR] Max reconnection attempts reached. Please refresh the page manually."
      );
      this.showConnectionStatus("failed");
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff with jitter
    const jitter = Math.random() * 500;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1) + jitter,
      this.maxReconnectDelay
    );

    console.log(
      `[HMR] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${
        this.reconnectAttempts
      }/${this.maxReconnectAttempts})...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private showConnectionStatus(
    status:
      | "connected"
      | "disconnected"
      | "reloading"
      | "building"
      | "failed"
      | "css-update"
  ): void {
    const event = new CustomEvent("hmr-status", { detail: { status } });
    window.dispatchEvent(event);
  }

  private setupBeforeUnload(): void {
    window.addEventListener("beforeunload", () => {
      this.isIntentionallyClosed = true;
      this.disconnect();
    });
  }

  /**
   * Reconnect when page becomes visible again
   */
  private setupVisibilityChange(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // Check connection when tab becomes visible
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
          console.log("[HMR] Tab visible, checking connection...");
          this.reconnectAttempts = 0; // Reset attempts
          this.connect();
        }
      }
    });
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Public method to manually trigger reconnection
   */
  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.isIntentionallyClosed = false;
    this.connect();
  }
}

// Initialize HMR client if port is provided
if (typeof window !== "undefined") {
  const hmrPort = (window as any).__ARCANAJS_HMR_PORT__;

  if (hmrPort) {
    const client = new HMRClient(hmrPort);

    // Expose client for debugging
    (window as any).__arcanaHMR = client;

    // Optional: Add visual indicator
    if (process.env.NODE_ENV === "development") {
      window.addEventListener("hmr-status", ((event: CustomEvent) => {
        // You can implement a visual indicator here
        // For example, a small badge in the corner showing connection status
      }) as EventListener);
    }
  }
}

export default HMRClient;
