#!/usr/bin/env node
/**
 * RASCI DSL — CLI
 *
 * Usage:
 *   rasci <input.rasci> [options]
 *
 * Options:
 *   -f, --format  <html|markdown|json>   Output format (default: html)
 *   -o, --output  <file>                 Output file (default: stdout)
 *   -t, --title   <text>                 Document title (default: filename without extension)
 *       --no-role-groups                 Suppress role group headers in columns
 *       --no-role-labels                 Suppress full role names in tooltips
 *   -h, --help                           Show this help message
 *
 * Examples:
 *   rasci matrix.rasci
 *   rasci matrix.rasci -f markdown -o matrix.md
 *   rasci matrix.rasci -f json     -o matrix.json
 *   rasci matrix.rasci -f html     -o matrix.html --no-role-groups
 */

import { readFileSync, writeFileSync } from "fs"
import { parse, validate }            from "./src/parser.js"
import { renderHTML }                 from "./src/renderer.html.js"
import { renderMarkdown }             from "./src/renderer.markdown.js"
import { basename, extname }          from "path"

// ---------------------------------------------------------------------------
// Argument Parser (no external package)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    input:          null,
    format:         "html",
    output:         null,
    title:          null,
    roleGroups:     true,
    roleLabels:     true,
    help:           false,
  }

  const positional = []
  let i = 0
  while (i < argv.length) {
    const a = argv[i]
    switch (a) {
      case "-h":
      case "--help":
        args.help = true
        break
      case "--no-role-groups":
        args.roleGroups  = false
        break
      case "--no-role-labels":
        args.roleLabels = false
        break
      case "-f":
      case "--format":
        args.format = argv[++i]
        break
      case "-o":
      case "--output":
        args.output = argv[++i]
        break
      case "-t":
      case "--title":
        args.title = argv[++i]
        break
      default:
        if (a.startsWith("-")) die(`Unknown option: ${a}`)
        positional.push(a)
    }
    i++
  }

  args.input = positional[0] ?? null
  return args
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function die(msg, code = 1) {
  console.error(`[rasci-cli] Error: ${msg}`)
  process.exit(code)
}

function printHelp() {
  console.log(`
Usage: rasci <input.rasci> [options]

Options:
  -f, --format  <html|markdown|json>   Output format (default: html)
  -o, --output  <file>                 Output file (default: stdout)
  -t, --title   <text>                 Document title (default: filename without extension)
      --no-role-groups                 Suppress role group headers in columns
      --no-role-labels                 Suppress full role names in tooltips
  -h, --help                           Show this help message

Examples:
  rasci matrix.rasci
  rasci matrix.rasci -f markdown -o matrix.md
  rasci matrix.rasci -f json     -o matrix.json
`.trim())
}

const FORMATS = new Set(["html", "markdown", "json"])

// ---------------------------------------------------------------------------
// JSON-Renderer (inline — kein eigenes Modul nötig)
// ---------------------------------------------------------------------------

import { flatRoles, flatTasks } from "./src/parser.js"
import { normalize }            from "./src/renderer.html.js"

function renderJSON(diagram) {
  const matrix = normalize(diagram)

  // Abgeflachte Matrix für maschinelle Weiterverarbeitung
  const flatMatrix = matrix.groups.flatMap(group =>
    group.tasks.map(row => ({
      group:       group.label || null,
      taskId:      row.task.id,
      taskLabel:   row.task.label,
      meta:        row.task.meta,
      assignments: Object.fromEntries(
        [...row.cells.entries()]
          .filter(([, attrs]) => attrs.length)
          .map(([alias, attrs]) => [alias, attrs])
      ),
    }))
  )

  const output = {
    roles:  flatRoles(diagram.roles),
    tasks:  flatTasks(diagram.tasks),
    matrix: flatMatrix,
  }

  return JSON.stringify(output, null, 2)
}

// ---------------------------------------------------------------------------
// HTML wrapper (full page instead of fragment, so the CLI output can be directly written to a .html file)
// TODO: Move to separate module if it grows too much or needs more features (e.g. custom CSS)
// ---------------------------------------------------------------------------

function wrapHTML(fragment, title) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif; padding: 2rem; background: #ffffff; color: #24292f; }
    h1   { font-size: 18px; font-weight: 600; margin-bottom: 1.5rem; color: #24292f; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${fragment}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Main program
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

if (!args.input) {
  printHelp()
  die("No input file specified.")
}

if (!FORMATS.has(args.format)) {
  die(`Unknown format "${args.format}". Allowed: html, markdown, json`)
}

// Read input file
let source
try {
  source = readFileSync(args.input, "utf8")
} catch (e) {
  die(`Input file not readable: ${args.input}\n  ${e.message}`)
}

// Derive title from filename if not provided
const title = args.title ?? basename(args.input, extname(args.input))

// Parse + Validate
let diagram
try {
  diagram = parse(source)
} catch (e) {
  die(e.message)
}

const { valid, errors } = validate(diagram)
if (!valid) {
  console.error("[rasci-cli] Validation errors:")
  errors.forEach(e => console.error("  " + e))
  process.exit(1)
}

// Render output
let output
switch (args.format) {
  case "html":
    output = wrapHTML(
      renderHTML(diagram, { showRoleGroups: args.roleGroups, showRoleLabels: args.roleLabels }),
      title
    )
    break
  case "markdown":
    output = renderMarkdown(diagram, { title })
    break
  case "json":
    output = renderJSON(diagram)
    break
}

// Output to file or stdout
if (args.output) {
  try {
    writeFileSync(args.output, output, "utf8")
    console.error(`[rasci-cli] ${args.output} written.`)
  } catch (e) {
    die(`Output file not writable: ${args.output}\n  ${e.message}`)
  }
} else {
  process.stdout.write(output + "\n")
}