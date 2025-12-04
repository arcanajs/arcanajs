import { toPascalCase } from "../../utils/toPascalCase";
import { writeFile } from "../../utils/writeFile";

const makeFactory = async (name: string) => {
  const modelName = name.replace("Factory", "");
  const content = `import { Factory } from 'arcanajs/arcanox'
import { ${modelName} } from '@/app/Models/${modelName}'

class ${toPascalCase(name)} extends Factory<${modelName}> {
  protected model = ${modelName}

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
