import { writeFile } from "../../utils/writeFile";
import { toPascalCase } from "../../utils/toPascalCase";

export default async function makeRequest(name: string) {
  const content = `import { FormRequest } from "arcanajs/validator";

class ${toPascalCase(name)} extends FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  public authorize(): boolean {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   */
  public rules(): Record<string, string> {
    return {
      // 'field': 'required|string',
    };
  }
}

export default ${toPascalCase(name)}`;

  await writeFile("app/Http/Requests", `${toPascalCase(name)}.ts`, content);
}
