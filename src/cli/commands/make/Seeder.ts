import { toPascalCase } from "../../utils/toPascalCase";
import { writeFile } from "../../utils/writeFile";

const makeSeeder = async (name: string) => {
  const content = `import { Seeder } from 'arcanajs/arcanox'

class ${toPascalCase(name)} extends Seeder {
  async run() {
    //
  }
}

export default ${toPascalCase(name)}
`;
  await writeFile("database/seeders", `${toPascalCase(name)}.ts`, content);
};

export default makeSeeder;
