import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const srcRoot = path.join(process.cwd(), "src");
const moduleCache = new Map();

function resolveTsPath(fromFilename, specifier) {
  let base;

  if (specifier.startsWith("@/")) {
    base = path.join(srcRoot, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(fromFilename), specifier);
  } else {
    return null;
  }

  const candidates = /\.tsx?$/.test(base) ? [base] : [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function loadTsModule(filename) {
  const cached = moduleCache.get(filename);

  if (cached) {
    return cached.exports;
  }

  const transpiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const loaded = { exports: {} };

  moduleCache.set(filename, loaded);
  vm.runInNewContext(transpiled, {
    exports: loaded.exports,
    module: loaded,
    require: createTsRequire(filename),
  }, { filename });

  return loaded.exports;
}

/**
 * A require for vm-loaded TS modules: relative and "@/" imports of .ts files are
 * transpiled and loaded (cached per file); anything else goes to Node's require.
 */
export function createTsRequire(fromFilename) {
  return (specifier) => {
    const tsPath = resolveTsPath(fromFilename, specifier);

    return tsPath ? loadTsModule(tsPath) : nodeRequire(specifier);
  };
}
