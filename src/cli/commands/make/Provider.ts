import { writeFile } from "../../utils/writeFile";
import { toPascalCase } from "../../utils/toPascalCase";

export default async function makeProvider(name: string) {
  const content = `import { ServiceProvider } from "arcanajs/server";

class ${toPascalCase(name)} extends ServiceProvider {
  /**
   * Register any application services.
   */
  public register(): void {
    // Bind services to the container
  }

  /**
   * Bootstrap any application services.
   */
  public boot(): void {
    // Run code on application startup
  }
}

export default ${toPascalCase(name)}`;

  await writeFile("app/Providers", `${toPascalCase(name)}.ts`, content);
}
