/**
 * ArcanaJS Hot Module Replacement (HMR) Client
 *
 * Professional HMR client with auto-reconnect, error handling,
 * and graceful degradation. Similar to Next.js HMR implementation.
 */

interface HMRMessage {
  type: "reload" | "error" | "connected" | "building";
  message?: string;
}

class HMRClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;

  constructor(private port: number) {
    this.connect();
    this.setupBeforeUnload();
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
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.socket.onerror = (error) => {
        console.error("[HMR] WebSocket error:", error);
      };

      this.socket.onclose = () => {
        if (!this.isIntentionallyClosed) {
          console.log("[HMR] Disconnected from development server");
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
          console.log("[HMR] Reloading page...");
          this.showConnectionStatus("reloading");
          window.location.reload();
          break;

        case "building":
          console.log("[HMR] Server is rebuilding...");
          this.showConnectionStatus("building");
          break;

        case "connected":
          console.log("[HMR] Server acknowledged connection");
          break;

        case "error":
          console.error("[HMR] Server error:", message.message);
          break;

        default:
          console.warn("[HMR] Unknown message type:", message);
      }
    } catch (error) {
      console.error("[HMR] Failed to parse message:", error);
    }
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
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
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
    status: "connected" | "disconnected" | "reloading" | "building" | "failed"
  ): void {
    // Optional: Show visual indicator to user
    // This can be implemented as a small toast/badge in the corner
    const event = new CustomEvent("hmr-status", { detail: { status } });
    window.dispatchEvent(event);

    // For debugging in development
    if (process.env.NODE_ENV === "development") {
      const emoji = {
        connected: "✅",
        disconnected: "🔌",
        reloading: "🔄",
        building: "🔨",
        failed: "❌",
      }[status];
      console.log(`[HMR] Status: ${emoji} ${status}`);
    }
  }

  private setupBeforeUnload(): void {
    window.addEventListener("beforeunload", () => {
      this.isIntentionallyClosed = true;
      this.disconnect();
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
  const hmrPort = (window as any).__ARCANA_HMR_PORT__;

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
