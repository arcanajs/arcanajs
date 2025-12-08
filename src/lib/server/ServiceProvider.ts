import ArcanaJSServer from "./ArcanaJSServer";

export abstract class ServiceProvider {
  protected app: ArcanaJSServer;

  constructor(app: ArcanaJSServer) {
    this.app = app;
  }

  /**
   * Register any application services.
   */
  register(): void {
    //
  }

  /**
   * Bootstrap any application services.
   */
  boot(): void {
    //
  }

  /**
   * Shutdown any application services.
   */
  async shutdown(): Promise<void> {
    //
  }
}
