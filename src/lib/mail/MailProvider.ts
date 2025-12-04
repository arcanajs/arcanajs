import { ServiceProvider } from "../server/support/ServiceProvider";
import { MailService } from "./MailService";
import { MailConfig } from "./types";

/**
 * Mail Service Provider
 *
 * Registers and bootstraps the mail system
 */
export class MailProvider extends ServiceProvider {
  async register() {
    console.log("⚙️  MailProvider: Initializing...");

    // Get config from container (loaded by ArcanaJSServer)
    let mailConfig: MailConfig | undefined;

    try {
      mailConfig = this.app.container.resolve<MailConfig>("MailConfig");
      console.log("✓ MailProvider: Configuration loaded successfully");
    } catch (err) {
      console.warn("⚠ MailProvider: No configuration found - Skipping setup");
      return;
    }

    try {
      // Initialize Mail Service
      await MailService.init(mailConfig);
      console.log(
        `✓ MailProvider: Service initialized with driver '${mailConfig.default}'`
      );

      // Register in container
      this.app.container.singleton("MailConfig", () => mailConfig!);
      this.app.container.singleton("MailService", () => MailService);

      console.log("✅ MailProvider: Ready");
    } catch (error) {
      console.error("✗ MailProvider: Initialization failed", error);
      throw error;
    }
  }

  async boot() {
    try {
      const config = this.app.container.resolve<MailConfig>("MailConfig");

      // Verify mail connection if not using log driver
      if (config && config.default !== "log") {
        console.log("⚙️  MailProvider: Verifying transporter connection...");
        const verified = await MailService.verify();
        if (verified) {
          console.log("✓ MailProvider: Transporter verified successfully");
        }
      }
    } catch (error) {
      console.warn("⚠ MailProvider: Transporter verification failed", error);
    }
  }
}
