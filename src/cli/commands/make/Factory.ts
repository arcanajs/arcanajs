import { toPascalCase } from "../../utils/toPascalCase";
import { writeFile } from "../../utils/writeFile";

const makeFactory = async (name: string) => {
  const modelName = name.replace("Factory", "");
  const content = `import { Factory } from 'arcanajs/arcanox'
import ${toPascalCase(modelName)} from '@/app/Models/${toPascalCase(modelName)}'

class ${toPascalCase(name)} extends Factory<${toPascalCase(modelName)}> {
  protected model = ${toPascalCase(modelName)}

  definition() {
    return {
      //
    }
  }
}

export default ${toPascalCase(name)}
`;
  await writeFile("database/factories", `${toPascalCase(name)}.ts`, content);
};

export default makeFactory;
