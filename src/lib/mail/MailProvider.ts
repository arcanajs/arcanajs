import fs from "fs";
import path from "path";
import { ServiceProvider } from "../server/support/ServiceProvider";
import { dynamicRequireSync } from "../server/utils/dynamicRequire";
import { MailService } from "./MailService";
import { MailConfig } from "./types";

/**
 * Mail Service Provider
 *
 * Registers and bootstraps the mail system
 */
export class MailProvider extends ServiceProvider {
  async register() {
    let mailConfig: MailConfig | undefined;

    // Try multiple possible config paths
    const possiblePaths = [
      path.resolve(process.cwd(), "dist/config/mail.js"),
      path.resolve(process.cwd(), "dist/config/mail.ts"),
      path.resolve(process.cwd(), "src/config/mail.ts"),
      path.resolve(process.cwd(), "src/config/mail.js"),
    ];

    let configLoaded = false;
    for (const configPath of possiblePaths) {
      // Check if file exists before trying to load it
      if (!fs.existsSync(configPath)) {
        continue;
      }

      try {
        const required = dynamicRequireSync(configPath);
        mailConfig = required.default || required.mailConfig || required;
        configLoaded = true;
        break;
      } catch (err) {
        // Try next path
        console.warn(`Failed to load mail config from ${configPath}:`, err);
        continue;
      }
    }

    if (!configLoaded) {
      console.warn("No mail config found. Skipping mail setup.");
      console.warn("Tried paths:", possiblePaths);
      return;
    }

    // At this point, mailConfig is guaranteed to be defined

    // Initialize Mail Service
    await MailService.init(mailConfig!);

    // Register in container
    this.app.container.singleton("MailConfig", () => mailConfig!);
    this.app.container.singleton("MailService", () => MailService);

    console.log(`Mail service initialized with driver: ${mailConfig!.default}`);
  }

  async boot() {
    // Verify mail connection if not using log driver
    const config = this.app.container.resolve<MailConfig>("MailConfig");

    if (config && config.default !== "log") {
      try {
        const verified = await MailService.verify();
        if (verified) {
          console.log("Mail transporter verified successfully");
        }
      } catch (error) {
        console.warn("Mail transporter verification failed:", error);
      }
    }
  }
}
