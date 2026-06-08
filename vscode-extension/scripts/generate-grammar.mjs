#!/usr/bin/env node
/**
 * RASCI DSL — TextMate Grammar Generator
 *
 * Reads:
 *   rasci.ebnf       — formal grammar (unchanged, from standard/)
 *   rasci.token-map  — mapping of EBNF rule names to TextMate scopes
 *
 * Writes:
 *   syntaxes/rasci.tmLanguage.json
 *   syntaxes/rasci-markdown-injection.tmLanguage.json
 *
 * Usage:
 *   node scripts/generate-grammar.js [options]
 *
 * Options:
 *   --ebnf  <path>   default: ../standard/rasci.ebnf (relative to this script)
 *   --map   <path>   default: ./rasci.token-map
 *   --out   <path>   default: ./syntaxes/rasci.tmLanguage.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve, dirname }                        from "path"
import { fileURLToPath }                           from "url"

const __dir = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    ebnf: resolve(__dir, "../../standard/rasci.ebnf"),
    map:  resolve(__dir, "../rasci.token-map"),
    out:  resolve(__dir, "../syntaxes/rasci.tmLanguage.json"),
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ebnf") args.ebnf = resolve(argv[++i])
    if (argv[i] === "--map")  args.map  = resolve(argv[++i])
    if (argv[i] === "--out")  args.out  = resolve(argv[++i])
  }
  return args
}

// ---------------------------------------------------------------------------
// Token-map parser
// ---------------------------------------------------------------------------

/**
 * @typedef {{ rule: string, token: string, pattern: string, order: number, label: string }} TokenDef
 */

/**
 * Parses rasci.token-map.
 * Each entry has the form:
 *   rule <name>
 *     token   <scope>
 *     pattern <regex>
 *     order   <n>
 *     [label  <text>]
 *
 * @param {string} source
 * @returns {TokenDef[]}
 */
function parseTokenMap(source) {
  const defs    = []
  let   current = null

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim()

    // skip comments and blank lines
    if (!line || line.startsWith("%%")) continue

    const ruleMatch    = line.match(/^rule\s+(\S+)/)
    const tokenMatch   = line.match(/^token\s+(.+)$/)
    const patternMatch = line.match(/^pattern\s+(.+)$/)
    const orderMatch   = line.match(/^order\s+(\d+)$/)
    const labelMatch   = line.match(/^label\s+(.+)$/)

    if (ruleMatch) {
      current = { rule: ruleMatch[1], token: "", pattern: "", order: 999, label: ruleMatch[1] }
      defs.push(current)
      continue
    }
    if (!current) continue
    if (tokenMatch)   current.token   = tokenMatch[1].trim()
    if (patternMatch) current.pattern = patternMatch[1].trim()
    if (orderMatch)   current.order   = parseInt(orderMatch[1], 10)
    if (labelMatch)   current.label   = labelMatch[1].trim()
  }

  // sort by priority (lower order = higher priority = matched first)
  defs.sort((a, b) => a.order - b.order)
  return defs.filter(d => d.token && d.pattern)
}

// ---------------------------------------------------------------------------
// Validate mapping against EBNF
// ---------------------------------------------------------------------------

/**
 * Warns when a mapped rule name does not appear in the EBNF.
 * Synthetic rules (e.g. section-kw, meta-kw) are explicitly allowed.
 */
function validateMapping(ebnfSource, defs) {
  const synthetic = new Set([
    "section-kw", "meta-kw", "assignment-role", "list-marker",
    "number", "colon", "bracket", "comma",
  ])
  const warnings  = []
  for (const def of defs) {
    const exists = new RegExp(`\\b${def.rule}\\s*::=`).test(ebnfSource) || synthetic.has(def.rule)
    if (!exists) {
      warnings.push(`  warning: "${def.rule}" not found in EBNF (synthetic rule?)`)
    }
  }
  return warnings
}

// ---------------------------------------------------------------------------
// TextMate grammar builder
// ---------------------------------------------------------------------------

function buildGrammar(defs) {
  const repository = {}

  for (const def of defs) {
    const key = def.rule.replace(/-/g, "_")
    repository[key] = {
      name:  `${def.token}.rasci`,
      match: def.pattern,
    }
  }

  // patterns are already sorted by priority via parseTokenMap
  const patterns = defs.map(def => ({
    include: `#${def.rule.replace(/-/g, "_")}`
  }))

  return {
    "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name:       "RASCI",
    scopeName:  "source.rasci",
    fileTypes:  ["rasci", "rasci-rules"],
    patterns:   patterns,
    repository: repository,
  }
}

// ---------------------------------------------------------------------------
// Markdown injection (static — does not depend on EBNF)
// ---------------------------------------------------------------------------

function buildMarkdownInjection() {
  return {
    "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name:              "RASCI in Markdown",
    scopeName:         "markdown.rasci.codeblock",
    injectionSelector: "L:text.html.markdown",
    patterns: [{ include: "#rasci-block" }],
    repository: {
      "rasci-block": {
        begin: "^(\\s*`{3,})(rasci)\\s*$",
        end:   "^(\\s*`{3,})\\s*$",
        beginCaptures: {
          "1": { name: "punctuation.definition.fenced.markdown" },
          "2": { name: "entity.name.function.fenced.markdown"   }
        },
        endCaptures: {
          "1": { name: "punctuation.definition.fenced.markdown" }
        },
        contentName: "meta.embedded.block.rasci",
        patterns:    [{ include: "source.rasci" }],
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2))

// read input files
let ebnfSource, mapSource
try {
  ebnfSource = readFileSync(args.ebnf, "utf8")
  console.log(`[generate-grammar] EBNF read:      ${args.ebnf}`)
} catch (e) {
  console.error(`[generate-grammar] cannot read EBNF: ${args.ebnf}`)
  console.error(`                   ${e.message}`)
  process.exit(1)
}

try {
  mapSource = readFileSync(args.map, "utf8")
  console.log(`[generate-grammar] token-map read: ${args.map}`)
} catch (e) {
  console.error(`[generate-grammar] cannot read token-map: ${args.map}`)
  console.error(`                   ${e.message}`)
  process.exit(1)
}

// parse token definitions
const defs = parseTokenMap(mapSource)
console.log(`[generate-grammar] ${defs.length} token definitions:`)
for (const d of defs) {
  console.log(`  [${String(d.order).padStart(3)}] ${d.rule.padEnd(20)} → ${d.token}.rasci`)
}

// validate mapping
const warnings = validateMapping(ebnfSource, defs)
if (warnings.length) warnings.forEach(w => console.log(w))

// build grammars
const grammar   = buildGrammar(defs)
const injection = buildMarkdownInjection()

// write output
const outDir = dirname(args.out)
mkdirSync(outDir, { recursive: true })

writeFileSync(args.out, JSON.stringify(grammar, null, 2), "utf8")
console.log(`[generate-grammar] grammar written:           ${args.out}`)

const injectionOut = args.out.replace(".tmLanguage.json", "-markdown-injection.tmLanguage.json")
writeFileSync(injectionOut, JSON.stringify(injection, null, 2), "utf8")
console.log(`[generate-grammar] markdown injection written: ${injectionOut}`)
