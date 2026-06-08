#!/usr/bin/env node
/**
 * RASCI DSL — Extension Bundle Builder
 *
 * Combines parser.js and renderer.html.js into a single CommonJS bundle
 * (dist/rasci-core.cjs) that the VS Code extension host can require()
 * without ES module support.
 *
 * Usage:
 *   node scripts/build-bundle.js [--src <path-to-rasci-src>]
 *
 * Default source path: ../../src (relative to this script)
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve, dirname }                        from "path"
import { fileURLToPath }                           from "url"

const __dir = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  // default: two levels up from vscode-extension/scripts/ reaches rasci/src/
  const args = { src: resolve(__dir, "..", "..", "src") }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--src") args.src = resolve(__dir, argv[++i])
  }
  return args
}

const args = parseArgs(process.argv.slice(2))

// read source files
const parserSrc   = readFileSync(resolve(args.src, "parser.js"),        "utf8")
const rendererSrc = readFileSync(resolve(args.src, "renderer.html.js"), "utf8")

// ---------------------------------------------------------------------------
// ESM → CJS conversion
//
// Transforms ES module syntax to CommonJS so the bundle can be require()'d:
//   - import { X } from "..."  → removed (everything is inlined)
//   - export function X        → function X  +  exports.X = X at the end
//   - export { X, Y }          → exports.X = X; exports.Y = Y at the end
// ---------------------------------------------------------------------------

function esmToCjs(source, label) {
  let out = source

  // 1. remove import statements (all modules are inlined into one file)
  out = out.replace(/^import\s+\{[^}]+\}\s+from\s+"[^"]+";?\s*$/gm, "")
  out = out.replace(/^import\s+[^\n]+from\s+"[^"]+";?\s*$/gm, "")

  // 2. strip export keyword and collect the exported names
  const namedExports = []
  out = out.replace(/^export\s+(function|class|const|let|var)\s+(\w+)/gm, (_, kw, name) => {
    namedExports.push(name)
    return `${kw} ${name}`
  })

  // 3. handle re-export blocks: export { X, Y, Z }
  out = out.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (_, names) => {
    names.split(",").map(n => n.trim()).forEach(n => namedExports.push(n))
    return ""
  })

  // 4. append exports object assignments
  if (namedExports.length) {
    const unique = [...new Set(namedExports)]
    out += `\n// exports from ${label}\n`
    out += unique.map(n => `exports.${n} = ${n}`).join("\n") + "\n"
  }

  return out
}

const parserCjs   = esmToCjs(parserSrc,   "parser.js")
const rendererCjs = esmToCjs(rendererSrc, "renderer.html.js")

// assemble the bundle
const bundle = `/**
 * rasci-core.cjs — auto-generated, do not edit manually
 * Contains: parser.js + renderer.html.js (CommonJS bundle)
 * Regenerate via: node scripts/build-bundle.js
 */
"use strict"

// ============================================================
// parser.js
// ============================================================

${parserCjs}

// ============================================================
// renderer.html.js
// ============================================================

${rendererCjs}
`

const outDir  = resolve(__dir, "../dist")
const outFile = resolve(outDir, "rasci-core.cjs")

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, bundle, "utf8")
console.log(`[build-bundle] written: ${outFile}`)
