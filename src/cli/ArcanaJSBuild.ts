import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
import webpack from "webpack";
import { WebSocket, WebSocketServer } from "ws";
import {
  createClientConfig,
  createMultiConfig,
  createServerConfig,
} from "./webpack.config";

// Build timing utilities
const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const printBuildSummary = (stats: webpack.Stats | webpack.MultiStats) => {
  const info = stats.toJson({
    assets: true,
    chunks: false,
    modules: false,
    timings: true,
  });

  if ("children" in info && info.children) {
    // Multi-compiler stats
    info.children.forEach((child) => {
      console.log(`\n📦 ${child.name}:`);
      console.log(`   Time: ${formatTime(child.time || 0)}`);
      console.log(`   Assets: ${child.assets?.length || 0} files`);
    });
  } else {
    console.log(`   Time: ${formatTime(info.time || 0)}`);
    console.log(`   Assets: ${info.assets?.length || 0} files`);
  }
};

export interface BuildOptions {
  /** Enable verbose output */
  verbose?: boolean;
  /** Clean output before build */
  clean?: boolean;
  /** Analyze bundle (production only) */
  analyze?: boolean;
}

/**
 * ArcanaJS Build System
 * Professional build system inspired by Next.js
 */
export class ArcanaJSBuild {
  private cwd: string;
  private serverProcess: ChildProcess | null = null;
  private wss: WebSocketServer | undefined;
  private hmrPort: number | undefined;
  private isServerBuilding = false;
  private isClientBuilding = false;
  private pendingReload = false;
  private pendingCSSUpdate = false;
  private buildStartTime = 0;
  private lastReloadTime = 0;
  private reloadDebounceMs = 100;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Production build - optimized and minified
   */
  public async build(options: BuildOptions = {}): Promise<void> {
    process.env.NODE_ENV = "production";
    this.buildStartTime = Date.now();

    console.log("\n🚀 Creating optimized production build...\n");

    // Clean .arcanajs directory
    if (options.clean !== false) {
      this.cleanBuildDir();
    }

    // Create multi-compiler for parallel build
    const configs = createMultiConfig();
    const compiler = webpack(configs);

    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        // Close compiler to free resources
        compiler.close((closeErr) => {
          if (closeErr) {
            console.error("Error closing compiler:", closeErr);
          }
        });

        if (err) {
          console.error("\n❌ Build failed with error:");
          console.error(err);
          return reject(err);
        }

        if (stats?.hasErrors()) {
          console.error("\n❌ Build failed with errors:");
          console.error(
            stats.toString({
              colors: true,
              preset: "errors-only",
            })
          );
          return reject(new Error("Webpack build failed"));
        }

        if (stats?.hasWarnings()) {
          console.warn("\n⚠️  Build completed with warnings:");
          console.warn(
            stats.toString({
              colors: true,
              preset: "errors-warnings",
            })
          );
        }

        // Print build summary
        if (stats) {
          printBuildSummary(stats);
        }

        const totalTime = Date.now() - this.buildStartTime;
        console.log(`\n✅ Build complete in ${formatTime(totalTime)}`);
        console.log(
          `   Output: ${path.relative(
            this.cwd,
            path.resolve(this.cwd, ".arcanajs")
          )}`
        );

        resolve();
      });
    });
  }

  /**
   * Development mode with HMR and watch
   */
  public async dev(options: BuildOptions = {}): Promise<void> {
    process.env.NODE_ENV = "development";
    this.buildStartTime = Date.now();

    console.log("\n🔧 Starting development server...\n");

    // Clean .arcanajs directory
    if (options.clean !== false) {
      this.cleanBuildDir();
    }

    // Setup HMR WebSocket server
    await this.setupHMR();

    // Create separate compilers for better control
    const clientConfig = createClientConfig();
    const serverConfig = createServerConfig();

    const clientCompiler = webpack(clientConfig);
    const serverCompiler = webpack(serverConfig);

    // Track server build state
    serverCompiler.hooks.invalid.tap("ArcanaJS", () => {
      this.isServerBuilding = true;
      this.broadcastBuildStatus("building", "server");
      console.log("\n🔄 Server rebuilding...");
    });

    clientCompiler.hooks.invalid.tap("ArcanaJS", () => {
      this.isClientBuilding = true;
      this.broadcastBuildStatus("building", "client");
      console.log("\n🔄 Client rebuilding...");
    });

    // Watch client
    this.watchCompiler("Client", clientCompiler, (stats) => {
      this.isClientBuilding = false;

      // Check if this is CSS-only change
      const cssOnly = stats ? this.isCSSOnlyChange(stats) : false;

      if (this.isServerBuilding) {
        console.log("⏳ Waiting for server build...");
        if (cssOnly) {
          this.pendingCSSUpdate = true;
        } else {
          this.pendingReload = true;
        }
      } else {
        if (cssOnly) {
          this.broadcastCSSUpdate();
        } else {
          this.broadcastReload();
        }
      }
    });

    // Watch server and restart on build
    this.watchCompiler("Server", serverCompiler, async () => {
      await this.startDevServer();
      this.isServerBuilding = false;

      // Handle pending updates
      if (this.pendingCSSUpdate) {
        this.broadcastCSSUpdate();
        this.pendingCSSUpdate = false;
      }
      if (this.pendingReload) {
        this.broadcastReload();
        this.pendingReload = false;
      }
    });

    // Initial build time
    setTimeout(() => {
      const startupTime = Date.now() - this.buildStartTime;
      console.log(`\n⚡ Ready in ${formatTime(startupTime)}`);
    }, 100);
  }

  /**
   * Start production server
   */
  public async start(): Promise<void> {
    process.env.NODE_ENV = "production";
    const serverPath = path.resolve(this.cwd, ".arcanajs/server/server.js");

    console.log("\n🚀 Starting production server...\n");

    if (!fs.existsSync(serverPath)) {
      console.error("❌ Server bundle not found. Run 'arcanajs build' first.");
      process.exit(1);
    }

    const child = spawn("node", [serverPath], {
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("error", (error) => {
      console.error("❌ Failed to start server:", error);
      process.exit(1);
    });

    child.on("close", (code) => {
      process.exit(code || 0);
    });
  }

  /**
   * Clean build directory
   */
  private cleanBuildDir(): void {
    const buildDir = path.resolve(this.cwd, ".arcanajs");
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
      console.log("🧹 Cleaned build directory");
    }
  }

  /**
   * Watch compiler with callbacks
   */
  private watchCompiler(
    name: string,
    compiler: webpack.Compiler,
    onBuildComplete?: (stats?: webpack.Stats) => void
  ): void {
    const watchOptions = compiler.options.watchOptions || {};
    let isFirstBuild = true;

    compiler.watch(watchOptions, (err, stats) => {
      if (err) {
        console.error(`\n❌ [${name}] Error:`, err);
        return;
      }

      if (stats?.hasErrors()) {
        console.error(`\n❌ [${name}] Build failed:`);
        console.error(
          stats.toString({
            colors: true,
            preset: "errors-only",
          })
        );
        return;
      }

      const time = stats?.toJson().time || 0;

      if (isFirstBuild) {
        console.log(`✓ [${name}] Initial build: ${formatTime(time)}`);
        isFirstBuild = false;
      } else {
        console.log(`✓ [${name}] Rebuilt in ${formatTime(time)}`);
      }

      if (stats && !stats.hasErrors() && onBuildComplete) {
        onBuildComplete(stats);
      }
    });
  }

  /**
   * Check if build only has CSS changes (no JS/TS changes)
   */
  private isCSSOnlyChange(stats: webpack.Stats): boolean {
    const statsJson = stats.toJson({
      all: false,
      modules: true,
    });

    if (!statsJson.modules || statsJson.modules.length === 0) {
      return false;
    }

    // Check modules that were rebuilt
    const rebuiltModules = statsJson.modules.filter((m) => m.built && m.name);

    if (rebuiltModules.length === 0) {
      return false;
    }

    // Check if ALL rebuilt modules are CSS files
    const allCSS = rebuiltModules.every((m) => {
      const name = m.name || "";
      return (
        name.endsWith(".css") ||
        name.includes(".css?") ||
        name.includes("css-loader") ||
        name.includes("style-loader")
      );
    });

    return allCSS;
  }

  /**
   * Setup HMR WebSocket server
   */
  private async setupHMR(): Promise<void> {
    const HMR_INITIAL_PORT = 3001;
    const MAX_PORT_ATTEMPTS = 10;

    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
      try {
        const currentPort = HMR_INITIAL_PORT + i;
        this.wss = await this.createWSS(currentPort);
        this.hmrPort = currentPort;
        console.log(`📡 HMR server on ws://localhost:${this.hmrPort}`);
        break;
      } catch (err: any) {
        if (err.code === "EADDRINUSE") {
          if (i === MAX_PORT_ATTEMPTS - 1) {
            throw new Error(
              `Could not start HMR server after ${MAX_PORT_ATTEMPTS} attempts.`
            );
          }
        } else {
          throw err;
        }
      }
    }

    if (!this.wss || !this.hmrPort) {
      throw new Error("Failed to start HMR server.");
    }

    // Graceful shutdown
    this.setupShutdownHandlers();
  }

  /**
   * Create WebSocket server with heartbeat
   */
  private createWSS(port: number): Promise<WebSocketServer> {
    return new Promise((resolve, reject) => {
      const server = new WebSocketServer({ port });

      server.on("listening", () => {
        // Start heartbeat to detect dead connections
        this.startHeartbeat(server);
        resolve(server);
      });

      server.on("error", (err) => reject(err));

      // Handle client connections
      server.on("connection", (ws: WebSocket & { isAlive?: boolean }) => {
        ws.isAlive = true;

        // Send welcome message
        ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));

        ws.on("pong", () => {
          ws.isAlive = true;
        });

        ws.on("error", () => {
          // Ignore client errors
        });
      });
    });
  }

  /**
   * Start heartbeat interval to detect dead connections
   */
  private startHeartbeat(server: WebSocketServer): void {
    this.heartbeatInterval = setInterval(() => {
      server.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Broadcast build status to all connected clients
   */
  private broadcastBuildStatus(
    status: "building" | "done",
    target: "client" | "server"
  ): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: "building",
      target,
      status,
      timestamp: Date.now(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast reload to all connected clients (debounced)
   */
  private broadcastReload(): void {
    if (!this.wss) return;

    // Debounce rapid reloads
    const now = Date.now();
    if (now - this.lastReloadTime < this.reloadDebounceMs) {
      return;
    }
    this.lastReloadTime = now;

    let clientCount = 0;
    const message = JSON.stringify({ type: "reload", timestamp: now });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        clientCount++;
      }
    });

    if (clientCount > 0) {
      console.log(`🔄 Reloading ${clientCount} client(s)...`);
    }
  }

  /**
   * Broadcast CSS update to all connected clients (no full reload)
   */
  private broadcastCSSUpdate(): void {
    if (!this.wss) return;

    let clientCount = 0;
    const message = JSON.stringify({
      type: "css-update",
      timestamp: Date.now(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        clientCount++;
      }
    });

    if (clientCount > 0) {
      console.log(`🎨 CSS hot update sent to ${clientCount} client(s)`);
    }
  }

  /**
   * Start development server
   */
  private startDevServer(): Promise<void> {
    return new Promise((resolve) => {
      // Kill existing server
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }

      const serverPath = path.resolve(this.cwd, ".arcanajs/server/server.js");

      if (!fs.existsSync(serverPath)) {
        console.error("❌ Server bundle not found");
        resolve();
        return;
      }

      this.serverProcess = spawn("node", [serverPath], {
        stdio: ["inherit", "pipe", "inherit"],
        env: {
          ...process.env,
          ARCANAJS_HMR_PORT: this.hmrPort?.toString(),
        },
      });

      let resolved = false;

      this.serverProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        process.stdout.write(output);

        // Resolve when server is ready
        if (!resolved && output.includes("Server is running")) {
          resolved = true;
          resolve();
        }
      });

      this.serverProcess.on("error", (error) => {
        console.error("❌ Server error:", error);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });

      this.serverProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
          console.error(`⚠️  Dev server exited with code ${code}`);
        }
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 10000);
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const cleanup = () => {
      console.log("\n\n👋 Shutting down...");

      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.wss) {
        this.wss.close();
      }

      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }

      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }
}

export default ArcanaJSBuild;
