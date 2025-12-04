import { spawn } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import webpack from "webpack";
import { createClientConfig, createServerConfig } from "./webpack.config";

declare module "webpack-node-externals";

const args = process.argv.slice(2);

// Handle custom environment file
const envFileArg = args.find((arg) => arg.startsWith("--env-file="));
const customEnvFile = envFileArg ? envFileArg.split("=")[1] : null;

if (customEnvFile) {
  const envPath = path.resolve(process.cwd(), customEnvFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`Loaded environment from ${customEnvFile}`);
  } else {
    console.warn(`Warning: Environment file ${customEnvFile} not found.`);
  }
} else {
  // Try to load .env by default
  dotenv.config();
}

const command = args[0];

if (!command) {
  console.error("Please specify a command: init, dev, build, start");
  process.exit(1);
}

const runCompiler = (compiler: webpack.Compiler) => {
  return new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      if (stats && stats.hasErrors()) {
        console.error(stats.toString({ colors: true }));
        return reject(new Error("Webpack build failed"));
      }
      console.log(stats?.toString({ colors: true }));
      resolve();
    });
  });
};

let serverProcess: ReturnType<typeof spawn> | null = null;

import { WebSocketServer } from "ws";

const startDevServer = (hmrPort: number): Promise<void> => {
  return new Promise((resolve) => {
    if (serverProcess) {
      serverProcess.kill();
    }

    const serverPath = path.resolve(process.cwd(), "dist/server.js");
    serverProcess = spawn("node", [serverPath], {
      stdio: ["inherit", "pipe", "inherit"],
      env: { ...process.env, ARCANA_HMR_PORT: hmrPort.toString() },
    });

    serverProcess.stdout?.on("data", (data) => {
      process.stdout.write(data);
      if (data.toString().includes("Server is running")) {
        resolve();
      }
    });

    serverProcess.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Dev server exited with code ${code}`);
      }
    });
  });
};

const watchCompiler = (
  compiler: webpack.Compiler,
  onBuildComplete?: () => void
) => {
  compiler.watch({}, (err, stats) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(stats?.toString({ colors: true }));

    if (stats && !stats.hasErrors() && onBuildComplete) {
      onBuildComplete();
    }
  });
};

const build = async () => {
  process.env.NODE_ENV = "production";
  console.log("Building for production...");

  const clientConfig = createClientConfig();
  const serverConfig = createServerConfig();

  try {
    await runCompiler(webpack(clientConfig));
    await runCompiler(webpack(serverConfig));
    console.log("Build complete.");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
};

const dev = async () => {
  process.env.NODE_ENV = "development";
  console.log("Starting development server...");

  const HMR_INITIAL_PORT = 3001;
  const MAX_PORT_ATTEMPTS = 10;
  let wss: WebSocketServer | undefined;
  let HMR_PORT: number | undefined;

  // Helper function to create WebSocket server with proper error handling
  const createWSS = (port: number): Promise<WebSocketServer> => {
    return new Promise((resolve, reject) => {
      const server = new WebSocketServer({ port });

      server.on("listening", () => {
        resolve(server);
      });

      server.on("error", (err: any) => {
        reject(err);
      });
    });
  };

  // Try to find an available port
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    try {
      const currentPort = HMR_INITIAL_PORT + i;
      wss = await createWSS(currentPort);
      HMR_PORT = currentPort;
      console.log(`HMR Server running on port ${HMR_PORT}`);
      break;
    } catch (err: any) {
      if (err.code === "EADDRINUSE") {
        console.warn(
          `Port ${HMR_INITIAL_PORT + i} is in use, trying next port...`
        );
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

  if (!wss || !HMR_PORT) {
    throw new Error("Failed to start HMR server.");
  }

  // Graceful shutdown handler
  const cleanup = () => {
    console.log("\nShutting down development server...");

    if (wss) {
      wss.close(() => {
        console.log("HMR server closed.");
      });
    }

    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }

    process.exit(0);
  };

  // Register cleanup handlers
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const broadcastReload = () => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "reload" }));
      }
    });
  };

  const clientConfig = createClientConfig();
  const serverConfig = createServerConfig();

  let isServerBuilding = false;
  let pendingReload = false;

  const serverCompiler = webpack(serverConfig);
  serverCompiler.hooks.invalid.tap("ArcanaJS", () => {
    isServerBuilding = true;
  });

  // Watch client
  watchCompiler(webpack(clientConfig), () => {
    console.log("Client build complete.");
    if (isServerBuilding) {
      console.log("Server is building. Waiting to reload...");
      pendingReload = true;
    } else {
      console.log("Reloading browsers...");
      broadcastReload();
    }
  });

  // Watch server and restart on build
  watchCompiler(serverCompiler, async () => {
    console.log("Server build complete. Restarting server...");
    await startDevServer(HMR_PORT);
    isServerBuilding = false;
    if (pendingReload) {
      console.log("Pending reload found. Reloading browsers...");
      broadcastReload();
      pendingReload = false;
    }
  });
};

const start = () => {
  process.env.NODE_ENV = "production";
  const serverPath = path.resolve(process.cwd(), "dist/server.js");
  console.log(`Starting server at ${serverPath}...`);

  const child = spawn("node", [serverPath], { stdio: "inherit" });

  child.on("close", (code) => {
    process.exit(code || 0);
  });
};

import { handleDb } from "./commands/db";
import { handleDependency } from "./commands/dependency";
import { handleMake } from "./commands/make";
import { handleMigrate } from "./commands/migrate";

switch (command) {
  case "build":
    build();
    break;
  case "dev":
    dev();
    break;
  case "start":
    start();
    break;
  default:
    if (command.startsWith("make:")) {
      handleMake(args);
    } else if (command.startsWith("migrate")) {
      handleMigrate(args);
    } else if (command.startsWith("db:")) {
      handleDb(args);
    } else if (command.startsWith("dependency:")) {
      handleDependency(args);
    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
}
