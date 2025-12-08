import { ServiceProvider } from "arcanajs/server";

export class AppServiceProvider extends ServiceProvider {
  /**
   * Register any application services.
   */
  public register(): void {
    // Example: Bind a service to the container
    // this.app.container.bind('MyService', MyServiceImpl);
  }

  /**
   * Bootstrap any application services.
   */
  public boot(): void {
    // Example: Run code on application startup
    console.log("AppServiceProvider booted!");
  }
}
