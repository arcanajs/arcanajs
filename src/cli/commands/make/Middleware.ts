import { writeFile } from "../../utils/writeFile";
import { toPascalCase } from "../../utils/toPascalCase";

export default async function makeMiddleware(name: string) {
  const content = `import { Middleware, NextFunction, Request, Response } from "arcanajs/server";

class ${toPascalCase(name)} implements Middleware {
  public handle(req: Request, res: Response, next: NextFunction): void {
    // Middleware logic here
    next();
  }
}

export default ${toPascalCase(name)}
`;

  await writeFile("app/Http/Middleware", `${toPascalCase(name)}.ts`, content);
}
