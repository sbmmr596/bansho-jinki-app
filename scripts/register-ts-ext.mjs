import { register } from "node:module";

// Game modules import extensionless paths (bundler resolution). Node's type
// stripper needs a .ts suffix, so tests of src/game register this hook first.
register("./resolve-ts-hook.mjs", import.meta.url);
