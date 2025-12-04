import { toPascalCase } from "../../utils/toPascalCase";
import { writeFile } from "../../utils/writeFile";

export const makeModel = async (name: string) => {
  const content = `import { Model } from 'arcanajs/arcanox'

class ${toPascalCase(name)} extends Model {
  // protected table = '${name.toLowerCase()}s'
  protected fillable = []
}

export default ${toPascalCase(name)}
`;
  await writeFile("app/Models", `${toPascalCase(name)}.ts`, content);
};

export default makeModel;

