import { execSync } from "child_process";
import fs from "fs";
import path from "path";

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

const detectPackageManager = (): PackageManager => {
  const cwd = process.cwd();

  if (fs.existsSync(path.join(cwd, "bun.lockb"))) {
    return "bun";
  }
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
};

const getInstallCommand = (pm: PackageManager, packages: string[]): string => {
  const pkgList = packages.join(" ");

  switch (pm) {
    case "npm":
      return `npm install ${pkgList}`;
    case "yarn":
      return `yarn add ${pkgList}`;
    case "pnpm":
      return `pnpm add ${pkgList}`;
    case "bun":
      return `bun add ${pkgList}`;
  }
};

const installDependencies = (
  packages: string[],
  devPackages: string[] = []
) => {
  const pm = detectPackageManager();
  console.log(`\n📦 Detected package manager: ${pm}\n`);

  if (packages.length > 0) {
    console.log(`Installing dependencies: ${packages.join(", ")}`);
    const installCmd = getInstallCommand(pm, packages);
    try {
      execSync(installCmd, { stdio: "inherit" });
      console.log("✅ Dependencies installed successfully!\n");
    } catch (error) {
      console.error("❌ Failed to install dependencies");
      process.exit(1);
    }
  }

  if (devPackages.length > 0) {
    console.log(`Installing dev dependencies: ${devPackages.join(", ")}`);
    let devInstallCmd: string;
    switch (pm) {
      case "npm":
        devInstallCmd = `npm install --save-dev ${devPackages.join(" ")}`;
        break;
      case "yarn":
        devInstallCmd = `yarn add --dev ${devPackages.join(" ")}`;
        break;
      case "pnpm":
        devInstallCmd = `pnpm add -D ${devPackages.join(" ")}`;
        break;
      case "bun":
        devInstallCmd = `bun add -d ${devPackages.join(" ")}`;
        break;
    }
    try {
      execSync(devInstallCmd, { stdio: "inherit" });
      console.log("✅ Dev dependencies installed successfully!\n");
    } catch (error) {
      console.error("❌ Failed to install dev dependencies");
      process.exit(1);
    }
  }
};

const installAuthDependencies = () => {
  console.log("🔐 Installing Auth Provider dependencies...\n");

  const dependencies = [
    "jsonwebtoken",
    "bcryptjs",
    "redis",
    "connect-redis",
    "express-session",
  ];

  const devDependencies = [
    "@types/jsonwebtoken",
    "@types/bcryptjs",
    "@types/express-session",
  ];

  installDependencies(dependencies, devDependencies);

  console.log("✨ Auth Provider dependencies installed!");
  console.log("You can now use AuthProvider in your application.\n");
};

const installMailDependencies = () => {
  console.log("📧 Installing Mail Provider dependencies...\n");

  const dependencies = [
    "nodemailer",
    "ejs",
    "handlebars",
    "ioredis",
    "@aws-sdk/client-ses",
    "@aws-sdk/credential-provider-node",
    "nodemailer-mailgun-transport",
  ];

  const devDependencies = ["@types/nodemailer", "@types/ejs"];

  installDependencies(dependencies, devDependencies);

  console.log("✨ Mail Provider dependencies installed!");
  console.log("You can now use MailProvider in your application.\n");
};

const installDatabaseDependencies = (dbType: string) => {
  console.log(
    `🗄️  Installing Database Provider dependencies for ${dbType}...\n`
  );

  const commonDependencies = ["@faker-js/faker", "reflect-metadata"];
  let specificDependencies: string[] = [];
  let devDependencies: string[] = [];

  switch (dbType.toLowerCase()) {
    case "mongo":
    case "mongodb":
      specificDependencies = ["mongodb"];
      console.log("Installing MongoDB dependencies...");
      break;
    case "postgres":
    case "postgresql":
    case "pg":
      specificDependencies = ["pg"];
      devDependencies = ["@types/pg"];
      console.log("Installing PostgreSQL dependencies...");
      break;
    case "mysql":
      specificDependencies = ["mysql2"];
      console.log("Installing MySQL dependencies...");
      break;
    default:
      console.error(
        `❌ Unknown database type: ${dbType}. Supported types: mongo, postgres, mysql`
      );
      process.exit(1);
  }

  const allDependencies = [...commonDependencies, ...specificDependencies];
  installDependencies(allDependencies, devDependencies);

  console.log("✨ Database Provider dependencies installed!");
  console.log("You can now use DatabaseProvider in your application.\n");
};

export const handleDependency = (args: string[]) => {
  const type = args[0].split(":")[1]; // auth, mail, database

  if (!type) {
    console.error("Please specify a dependency type: auth, mail, or database");
    console.log("\nUsage:");
    console.log("  npx arcanajs dependency:auth");
    console.log("  npx arcanajs dependency:mail");
    console.log("  npx arcanajs dependency:database [mongo|postgres|mysql]");
    process.exit(1);
  }

  switch (type) {
    case "auth":
      installAuthDependencies();
      break;
    case "mail":
      installMailDependencies();
      break;
    case "database":
      const dbType = args[1];
      if (!dbType) {
        console.error(
          "Please specify a database type: mongo, postgres, or mysql"
        );
        console.log("\nUsage:");
        console.log("  npx arcanajs dependency:database mongo");
        console.log("  npx arcanajs dependency:database postgres");
        console.log("  npx arcanajs dependency:database mysql");
        process.exit(1);
      }
      installDatabaseDependencies(dbType);
      break;
    default:
      console.error(`Unknown dependency type: ${type}`);
      console.log("\nAvailable types:");
      console.log("  - auth");
      console.log("  - mail");
      console.log("  - database");
      process.exit(1);
  }
};
