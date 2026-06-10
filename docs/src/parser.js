/**
 * RASCI DSL — Parser
 *
 * Input:   Source text (%%rasci …)
 * Output:  RasciDiagram (Intermediate Representation)
 *
 * Types (JSDoc):
 *
 * @typedef {{ alias: string, label: string, group: string[] }}          Role
 * @typedef {{ kind: "role",  role:  Role }}                             RoleLeaf
 * @typedef {{ kind: "group", label: string, children: RoleNode[] }}     RoleGroup
 * @typedef {RoleLeaf | RoleGroup}                                        RoleNode
 *
 * @typedef {"R"|"A"|"S"|"C"|"I"}                                        RasciChar
 * @typedef {{ roleAlias: string, attrs: RasciChar[] }}                  Assignment
 * @typedef {{ desc?: string, link?: string }}                           Meta
 * @typedef {{ id: string, label: string, meta: Meta, assignments: Assignment[] }} Task
 * @typedef {{ kind: "task",  task:  Task }}                             TaskLeaf
 * @typedef {{ kind: "group", label: string, meta: Meta, children: TaskNode[] }} TaskGroup
 * @typedef {TaskLeaf | TaskGroup}                                        TaskNode
 * @typedef {{ roles: RoleNode[], tasks: TaskNode[] }}                   RasciDiagram
 */

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Label → slug (fallback for Task-IDs without explicit ID) */
function slug(label) {
  return label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

/** Label → Alias (fallback for roles without explicit alias) */
function defaultAlias(label) {
  return label.trim()
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const TK = /** @type {const} */ ({
  KEYWORD:    "KEYWORD",    // roles, tasks, group
  META_KEY:   "META_KEY",   // desc, link
  IDENT:      "IDENT",      // PO, BE, T01, …
  STRING:     "STRING",     // "…"
  RASCI:      "RASCI",      // [R,A,S,C,I] → einzelne Zeichen darin
  COLON:      "COLON",      // :
  LBRACKET:   "LBRACKET",   // [
  RBRACKET:   "RBRACKET",   // ]
  COMMA:      "COMMA",      // ,
  NEWLINE:    "NEWLINE",
  INDENT:     "INDENT",     // Einrückungstiefe (Anzahl führende Spaces / 2)
  EOF:        "EOF",
})

const KEYWORDS  = new Set(["roles", "tasks", "group"])
const META_KEYS = new Set(["desc", "link"])
const RASCI_CHARS = new Set(["R", "A", "S", "C", "I"])

/**
 * @param {string} source
 * @returns {{ type: string, value: string|number, line: number, col: number }[]}
 */
function tokenize(source) {
  const tokens = []
  const lines  = source.split("\n")
  let lineNo   = 0

  for (const raw of lines) {
    lineNo++

    // comments and empty lines
    const stripped = raw.replace(/%%.*$/, "").trimEnd()
    if (!stripped.trim()) continue

    // measure indentation (2 spaces = 1 level)
    const indent = Math.floor((stripped.length - stripped.trimStart().length) / 2)
    tokens.push({ type: TK.INDENT, value: indent, line: lineNo, col: 1 })

    let i = stripped.trimStart().length > 0
      ? stripped.length - stripped.trimStart().length
      : stripped.length

    const push = (type, value) => tokens.push({ type, value, line: lineNo, col: i + 1 })

    while (i < stripped.length) {
      // skip whitespace
      if (stripped[i] === " " || stripped[i] === "\t") {
        i++
        continue
    }

      // string literal
      if (stripped[i] === '"') {
        let j = i + 1
        while (j < stripped.length && stripped[j] !== '"') j++
        push(TK.STRING, stripped.slice(i + 1, j))
        i = j + 1
        continue
      }

      // punctuation
      if (stripped[i] === ":") {
        push(TK.COLON,    ":")
        i++
        continue
    }
      if (stripped[i] === "[") {
        push(TK.LBRACKET,  "[")
        i++
        continue
      }
      if (stripped[i] === "]") {
        push(TK.RBRACKET,  "]")
        i++
        continue
      }
      if (stripped[i] === ",") {
        push(TK.COMMA,     ",")
        i++
        continue
      }

      // identifier / keyword / RASCI char
      if (/[A-Za-z_]/.test(stripped[i])) {
        let j = i
        while (j < stripped.length && /[A-Za-z0-9_]/.test(stripped[j])) j++
        const word = stripped.slice(i, j)
        if      (KEYWORDS.has(word))   push(TK.KEYWORD,  word)
        else if (META_KEYS.has(word))  push(TK.META_KEY, word)
        else                           push(TK.IDENT,    word)
        i = j
        continue
      }

      // unknown character — skip with warning
      console.warn(`[rasci:tokenize] Unknown character '${stripped[i]}' in line ${lineNo}`)
      i++
    }

    push(TK.NEWLINE, "\n")
  }

  tokens.push({ type: TK.EOF, value: null, line: lineNo + 1, col: 1 })
  return tokens
}

// ---------------------------------------------------------------------------
// Token Stream Helper
// ---------------------------------------------------------------------------

class TokenStream {
  constructor(tokens) {
    this._t = tokens
    this._i = 0
  }

  peek()      { return this._t[this._i] }
  advance()   { return this._t[this._i++] }
  isEOF()     { return this.peek().type === TK.EOF }

  /** Returns true if the current token matches the given type (and optionally value). */
  is(type, value = undefined) {
    const t = this.peek()
    return t.type === type && (value === undefined || t.value === value)
  }

  /** Consumes the token if it matches, otherwise throws a ParseError. */
  expect(type, value = undefined) {
    const t = this.peek()
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      const got = `${t.type}(${JSON.stringify(t.value)})`
      const exp = value !== undefined ? `${type}(${JSON.stringify(value)})` : type
      throw new ParseError(`Expected ${exp}, got ${got}`, t.line, t.col)
    }
    return this.advance()
  }

  /** Skips all NEWLINE tokens. */
  skipNewlines() {
    while (this.is(TK.NEWLINE)) this.advance()
  }

  /** Returns the indentation level of the next non-Newline token. */
  currentIndent() {
    // Look ahead: after INDENT always follows the first real token of the line (or EOF)
    let i = this._i
    while (i < this._t.length && this._t[i].type === TK.NEWLINE) i++
    if (this._t[i].type === TK.INDENT) return this._t[i].value
    return 0
  }

  /** Consumes the INDENT token and returns its value. */
  consumeIndent() {
    if (this.is(TK.INDENT)) return this.advance().value
    return 0
  }
}

// ---------------------------------------------------------------------------
// ParseError
// ---------------------------------------------------------------------------

class ParseError extends Error {
  constructor(message, line, col) {
    super(`[rasci:parse] Line ${line}, Column ${col}: ${message}`)
    this.line = line
    this.col  = col
  }
}

// ---------------------------------------------------------------------------
// Parser (Recursive Descent)
// ---------------------------------------------------------------------------

/**
 * @param {string} source
 * @returns {RasciDiagram}
 */
export function parse(source) {
  const tokens = tokenize(source)
  const ts     = new TokenStream(tokens)

  // Optional %%rasci-Header (filtered out as a comment - here just for safety)
  ts.skipNewlines()

  const roles = parseRolesSection(ts)
  ts.skipNewlines()
  const tasks = parseTasksSection(ts)

  return { roles, tasks }
}

// ---------------------------------------------------------------------------
// Roles Section
// ---------------------------------------------------------------------------

function parseRolesSection(ts) {
  consumeIndentedLine(ts, 0)
  ts.expect(TK.KEYWORD, "roles")
  ts.expect(TK.COLON)
  ts.skipNewlines()
  return parseRoleBlock(ts, 1)
}

/** Reads all RoleNodes at the given indentation level. */
function parseRoleBlock(ts, depth) {
  const nodes = []
  while (!ts.isEOF()) {
    ts.skipNewlines()
    if (ts.isEOF()) break
    if (ts.currentIndent() < depth) break

    consumeIndentedLine(ts, depth)

    if (ts.is(TK.KEYWORD, "group")) {
      nodes.push(parseRoleGroup(ts, depth))
    } else {
      nodes.push(parseRoleDef(ts))
    }
  }
  return nodes
}

function parseRoleGroup(ts, depth) {
  ts.expect(TK.KEYWORD, "group")
  const label = ts.expect(TK.STRING).value
  ts.expect(TK.COLON)
  ts.skipNewlines()
  const children = parseRoleBlock(ts, depth + 1)
  return { kind: "group", label, children }
}

function parseRoleDef(ts) {
  // [IDENT] STRING, with or without alias
  let alias, label

  if (ts.is(TK.IDENT)) {
    alias = ts.advance().value
    label = ts.expect(TK.STRING).value
  } else {
    label = ts.expect(TK.STRING).value
    alias = defaultAlias(label)
  }

  ts.skipNewlines()
  return { kind: "role", role: { alias, label, group: [] } }
}

// ---------------------------------------------------------------------------
// Tasks Section
// ---------------------------------------------------------------------------

function parseTasksSection(ts) {
  consumeIndentedLine(ts, 0)
  ts.expect(TK.KEYWORD, "tasks")
  ts.expect(TK.COLON)
  ts.skipNewlines()
  return parseTaskBlock(ts, 1)
}

function parseTaskBlock(ts, depth) {
  const nodes = []
  while (!ts.isEOF()) {
    ts.skipNewlines()
    if (ts.isEOF()) break
    if (ts.currentIndent() < depth) break

    consumeIndentedLine(ts, depth)

    if (ts.is(TK.KEYWORD, "group")) {
      nodes.push(parseTaskGroup(ts, depth))
    } else {
      nodes.push(parseTaskDef(ts, depth))
    }
  }
  return nodes
}

function parseTaskGroup(ts, depth) {
  ts.expect(TK.KEYWORD, "group")
  const label = ts.expect(TK.STRING).value
  ts.expect(TK.COLON)
  ts.skipNewlines()

  const meta     = parseMeta(ts, depth + 1)
  const children = parseTaskBlock(ts, depth + 1)
  return { kind: "group", label, meta, children }
}

function parseTaskDef(ts, depth) {
  // [IDENT] STRING COLON
  let id, label

  if (ts.is(TK.IDENT)) {
    id    = ts.advance().value
    label = ts.expect(TK.STRING).value
  } else {
    label = ts.expect(TK.STRING).value
    id    = slug(label)
  }

  ts.expect(TK.COLON)
  ts.skipNewlines()

  const meta        = parseMeta(ts, depth + 1)
  const assignments = parseAssignments(ts, depth + 1)

  return { kind: "task", task: { id, label, meta, assignments } }
}

// ---------------------------------------------------------------------------
// Meta and Assignments
// ---------------------------------------------------------------------------

function parseMeta(ts, depth) {
  const meta = {}
  while (!ts.isEOF()) {
    ts.skipNewlines()
    if (ts.isEOF() || ts.currentIndent() < depth) break
    // Look ahead: is the next real token a META_KEY?
    const saved = ts._i
    consumeIndentedLine(ts, depth)
    if (!ts.is(TK.META_KEY)) {
      ts._i = saved // rewind
      break
    }
    const key = ts.advance().value   // "desc" | "link"
    ts.expect(TK.COLON)
    const val = ts.expect(TK.STRING).value
    meta[key] = val
    ts.skipNewlines()
  }
  return meta
}

function parseAssignments(ts, depth) {
  const assignments = []
  while (!ts.isEOF()) {
    ts.skipNewlines()
    if (ts.isEOF() || ts.currentIndent() < depth) break

    // Assignments are on a single line — we read all at this indentation level until the next NEWLINE or INDENT
    consumeIndentedLine(ts, depth)

    while (!ts.isEOF() && !ts.is(TK.NEWLINE) && !ts.is(TK.INDENT)) {
      // (IDENT | STRING) [ RASCI_LIST ]
      let roleAlias
      if (ts.is(TK.IDENT) || ts.is(TK.STRING)) {
        roleAlias = ts.advance().value
      } else {
        const t = ts.peek()
        throw new ParseError(
          `Expected role alias (IDENT or quoted STRING), got ${t.type}(${JSON.stringify(t.value)})`,
          t.line,
          t.col
        )
      }
      ts.expect(TK.LBRACKET)
      const attrs = parseRasciList(ts)
      ts.expect(TK.RBRACKET)
      assignments.push({ roleAlias, attrs })
      // Optional whitespace between assignments on the same line is already handled by the tokenizer, so we just continue until NEWLINE or INDENT.
    }

    ts.skipNewlines()
  }
  return assignments
}

function parseRasciList(ts) {
  const attrs = []
  while (!ts.is(TK.RBRACKET)) {
    const t = ts.advance()
    if (!RASCI_CHARS.has(t.value)) {
      throw new ParseError(`Invalid RASCI character: '${t.value}'`, t.line, t.col)
    }
    attrs.push(t.value)
    if (ts.is(TK.COMMA)) ts.advance()
  }
  if (attrs.length === 0) throw new ParseError("Empty RASCI assignment []", ts.peek().line, ts.peek().col)
  return attrs
}

// ---------------------------------------------------------------------------
// Helper function: consume INDENT token at given depth (if present), otherwise do nothing
// ---------------------------------------------------------------------------

function consumeIndentedLine(ts, expectedDepth) {
  if (ts.is(TK.INDENT)) {
    const ind = ts.advance()
    if (ind.value !== expectedDepth) {
      // Tolerant: rewind if incorrect depth (caller decides whether to error or just treat it as no indent)
      ts._i--
    }
  }
}

// ---------------------------------------------------------------------------
// Validation — call after parsing
// ---------------------------------------------------------------------------

/**
 * Checks the following constraints:
 *  1. Referential integrity    — all roleAlias in assignments must be defined in roles
 *  2. Duplicate role aliases   — each alias must be declared only once
 *  3. Duplicate task IDs       — each task ID must be unique
 *  4. A-rule                   — each task can have at most one Accountable
 *
 * @param {RasciDiagram} diagram
 * @returns {{ valid: boolean, infos: string[], warnings: string[], errors: string[] }}
 */
export function validate(diagram) {
  const infos = []
  const warnings = []
  const errors = []

  // (1), (2) Role aliases ---
  const allAliases = collectAliases(diagram.roles)
  const aliasSet   = new Set()
  for (const alias of allAliases) {
    if (aliasSet.has(alias)) {
      errors.push(`Role alias "${alias}" is defined multiple times`)
    } else {
      aliasSet.add(alias)
    }
  }

  // (3), (4) Tasks
  const taskIdSet = new Set()
  for (const task of flatTasks(diagram.tasks)) {

    // (3) Duplicate task ID
    if (taskIdSet.has(task.id)) {
      errors.push(`Task ID "${task.id}" is assigned multiple times (Label: "${task.label}")`)
    } else {
      taskIdSet.add(task.id)
    }

    // (1) Unknown aliases in assignments
    for (const a of task.assignments) {
      if (!aliasSet.has(a.roleAlias)) {
        errors.push(`Task "${task.label}": unknown alias "${a.roleAlias}"`)
      }
    }

    // (4) A-rule: at most one Accountable per task
    const accountable = task.assignments.filter(a => a.attrs.includes("A"))
    if (accountable.length > 1) {
      const names = accountable.map(a => `"${a.roleAlias}"`).join(", ")
      warnings.push(`Task "${task.label}": multiple Accountable (A) assigned — ${names}`)
    }
  }

  return { valid: errors.length === 0, infos, warnings, errors }
}

// ---------------------------------------------------------------------------
// Helper functions for renderers
// ---------------------------------------------------------------------------

/** All roles as a flat list (depth-first, group path populated). */
export function flatRoles(roleNodes, path = []) {
  const result = []
  for (const node of roleNodes) {
    if (node.kind === "role") {
      result.push({ ...node.role, group: path })
    } else {
      result.push(...flatRoles(node.children, [...path, node.label]))
    }
  }
  return result
}

/** All tasks as a flat list (only leaves). */
export function flatTasks(taskNodes) {
  const result = []
  for (const node of taskNodes) {
    if (node.kind === "task")  result.push(node.task)
    else                       result.push(...flatTasks(node.children))
  }
  return result
}

/** All aliases as a set (for validation). */
function collectAliases(roleNodes) {
  const aliases = []
  for (const node of roleNodes) {
    if (node.kind === "role")  aliases.push(node.role.alias)
    else                       aliases.push(...collectAliases(node.children))
  }
  return aliases
}