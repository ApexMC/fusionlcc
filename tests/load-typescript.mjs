import { readFile } from "node:fs/promises"
import ts from "typescript"

// Use the project's compiler so these tests also run on Node versions without
// native TypeScript support. The reporting helpers have no runtime dependencies.
export async function loadTypeScriptModule(relativePath) {
  const filename = new URL(relativePath, import.meta.url)
  const source = await readFile(filename, "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    fileName: filename.pathname,
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}
