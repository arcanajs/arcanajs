import { toPascalCase } from "../../utils/toPascalCase";
import { writeFile } from "../../utils/writeFile";

const makeMigration = async (name: string) => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(
    now.getDate()
  )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  const fileName = `${timestamp}_${name}.ts`;
  const tableName = name
    .replace(/^create_/, "")
    .replace(/_table$/, "")
    .toLowerCase();

  const content = `import { Migration, Schema } from 'arcanajs/arcanox'

class ${toPascalCase(name)} extends Migration {
  async up() {
    // await Schema.create('${tableName}', (table) => {
    //   table.id()
    //   table.timestamps()
    // })
  }

  async down() {
    // await Schema.dropIfExists('${tableName}')
  }
}

export default ${toPascalCase(name)}
`;
  await writeFile("database/migrations", fileName, content);
};

export default makeMigration;
