import { toPascalCase } from "../../utils/toPascalCase";
import { writeFile } from "../../utils/writeFile";

type ControllerType = "normal" | "api" | "resource";

const makeController = async (
  name: string,
  type: ControllerType = "normal"
) => {
  let methods = "";

  if (type === "resource") {
    // Full resource controller with all 7 RESTful methods
    methods = `
  async index(req: Request, res: Response) {
    //
  }

  async create(req: Request, res: Response) {
    //
  }

  async store(req: Request, res: Response) {
    //
  }

  async show(req: Request, res: Response) {
    //
  }

  async edit(req: Request, res: Response) {
    //
  }

  async update(req: Request, res: Response) {
    //
  }

  async destroy(req: Request, res: Response) {
    //
  }
`;
  } else if (type === "api") {
    // API controller with 4 methods (no create/edit views)
    methods = `
  async index(req: Request, res: Response) {
    //
  }

  async store(req: Request, res: Response) {
    //
  }

  async show(req: Request, res: Response) {
    //
  }

  async update(req: Request, res: Response) {
    //
  }

  async destroy(req: Request, res: Response) {
    //
  }
`;
  } else {
    // Normal controller - empty
    methods = `
  //
`;
  }

  const content = `import { Request, Response } from 'arcanajs/server'

class ${toPascalCase(name)} {${methods}}

export default ${toPascalCase(name)}
`;
  await writeFile("app/Http/Controllers", `${toPascalCase(name)}.ts`, content);
};

export default makeController;
