import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  // tsconfig/vite alias "@/…" → src/…
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const target = pathToFileURL(SRC + (extname(rel) === "" ? `${rel}.ts` : rel)).href;
    return nextResolve(target, context);
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    extname(specifier) === ""
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
