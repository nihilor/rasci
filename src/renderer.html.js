/**
 * RASCI DSL — HTML-Renderer
 *
 * Input:  RasciDiagram (IR from parser.js)
 * Output:  HTML string (table fragment only; no CSS)
 *
 * Features:
 *  - Task groups as color-coded headers
 *  - Role groups as column group headers (optional, default: on)
 *  - desc as title attribute (tooltip)
 *  - link as ↗ anchor next to label
 *  - RASCI cells color-coded via CSS classes
 *  - Styling is provided via external stylesheet (rasci-table.css)
 */

import { flatRoles, flatTasks } from "./parser.js"

// ---------------------------------------------------------------------------
// Normalize: IR to NormalizedMatrix
// ---------------------------------------------------------------------------

/**
 * @typedef {{ roles: import("./parser.js").Role[], groups: TaskGroup[] }} NormalizedMatrix
 * @typedef {{ label: string, meta: import("./parser.js").Meta, tasks: TaskRow[] }} TaskGroup
 * @typedef {{ task: import("./parser.js").Task, cells: Map<string, string[]> }} TaskRow
 */

/**
 * @param {import("./parser.js").RasciDiagram} diagram
 * @returns {NormalizedMatrix}
 */
export function normalize(diagram) {
  const roles = flatRoles(diagram.roles)

  // Tasks in groups; tasks without a group get implicit group with label ""
  const groups = []

  function walkTaskNodes(nodes) {
    let ungrouped = []
    for (const node of nodes) {
      if (node.kind === "task") {
        ungrouped.push(node.task)
      } else {
        // First, flush any pending ungrouped tasks into an implicit group
        if (ungrouped.length) {
          groups.push({ label: "", meta: {}, tasks: buildRows(ungrouped, roles) })
          ungrouped = []
        }
        const tasks = flatTasks(node.children)
        groups.push({ label: node.label, meta: node.meta, tasks: buildRows(tasks, roles) })
      }
    }
    if (ungrouped.length) {
      groups.push({ label: "", meta: {}, tasks: buildRows(ungrouped, roles) })
    }
  }

  walkTaskNodes(diagram.tasks)
  return { roles, groups }
}

function buildRows(tasks, roles) {
  return tasks.map(task => {
    const cells = new Map(roles.map(r => [r.alias, []]))
    for (const a of task.assignments) {
      if (cells.has(a.roleAlias)) cells.set(a.roleAlias, a.attrs)
    }
    return { task, cells }
  })
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * @param {import("./parser.js").RasciDiagram} diagram
 * @param {{ showRoleGroups?: boolean, showRoleLabels?: boolean, showAliasesOnly?: boolean }} [options]
 * @returns {string}  HTML string (table fragment without a document wrapper)
 */
export function renderHTMLTable(diagram, options = {}) {
  const { showRoleGroups = true, showRoleLabels = true, showAliasesOnly = false } = options
  const matrix = normalize(diagram)
  const { roles, groups } = matrix

  const colCount = roles.length + 1 // +1 for task column

  // Determine column group structure (for optional group header)
  const roleGroupSpans = buildRoleGroupSpans(roles)

  const lines = []

  lines.push(`<div class="rasci-wrapper">`)
  lines.push(`<table class="rasci-table" role="grid">`)

  // ------------------------------------------------------------------
  // Table header
  // ------------------------------------------------------------------
  lines.push(`<thead>`)

  // Row 1: Role group header (optional)
  if (showRoleGroups && roleGroupSpans.some(s => s.label)) {
    lines.push(`<tr>`)
    lines.push(`<th class="rasci-corner"></th>`)
    for (const span of roleGroupSpans) {
      lines.push(
        `<th class="rasci-group-header" colspan="${span.count}">${esc(span.label)}</th>`
      )
    }
    lines.push(`</tr>`)
  }

  // Row 2: Role aliases (always visible)
  lines.push(`<tr>`)
  lines.push(`<th class="rasci-task-header">Task</th>`)
  for (const role of roles) {
    const title = showRoleLabels ? ` title="${esc(role.label)}"` : ""
    const content = showAliasesOnly ? esc(role.alias) : esc(`${role.label}${role.alias !== role.label ? ` (${role.alias})` : ""}`)
    lines.push(`<th class="rasci-role-header"${title}>${content}</th>`)
  }
  lines.push(`</tr>`)
  lines.push(`</thead>`)

  // ------------------------------------------------------------------
  // Table body
  // ------------------------------------------------------------------
  lines.push(`<tbody>`)

  for (const group of groups) {
    // Group header (if label is not empty)
    if (group.label) {
      const link = group.meta.link
        ? ` <a class="rasci-link" href="${esc(group.meta.link)}" target="_blank" rel="noopener">↗</a>`
        : ""
      const desc = group.meta.desc ? ` title="${esc(group.meta.desc)}"` : ""
      lines.push(
        `<tr><td class="rasci-phase-header" colspan="${colCount}"${desc}>${esc(group.label)}${link}</td></tr>`
      )
    }

    // Task rows
    for (const row of group.tasks) {
      const { task, cells } = row
      const taskLink  = task.meta.link
        ? ` <a class="rasci-link" href="${esc(task.meta.link)}" target="_blank" rel="noopener">↗</a>`
        : ""
      const taskTitle = task.meta.desc ? ` title="${esc(task.meta.desc)}"` : ""
      const taskMain  = `<span class="rasci-task-main">${esc(task.label)}${taskLink}</span>`
      const taskDesc  = task.meta.desc
        ? `<details class="rasci-task-details" open><summary>${taskMain}</summary><div class="rasci-task-desc">${esc(task.meta.desc)}</div></details>`
        : taskMain

      lines.push(`<tr>`)
      lines.push(`<td class="rasci-task-label"${taskTitle}>${taskDesc}</td>`)

      for (const role of roles) {
        const attrs = cells.get(role.alias) ?? []
        // wrap every attribute in a <span> for better styling control (e.g. multiple RASCI values, or future extensions like tags or comments)
        const text  = attrs.map(attr => `<span class="rasci-attr rasci-${attr}">${esc(attr)}</span>`).join(", ")
        const cls   = 'rasci-cell' + (attrs.length ? '' : ' rasci-empty')
        lines.push(`<td class="${cls}">${text}</td>`)
      }

      lines.push(`</tr>`)
    }
  }

  lines.push(`</tbody>`)
  lines.push(`</table>`)
  lines.push(`</div>`)

  return lines.join("\n")
}

/**
 * @param {import("./parser.js").RasciDiagram} diagram
 * @param {{ showRoleGroups?: boolean, showRoleLabels?: boolean }} [options]
 * @returns {string}  HTML string (table fragment)
 */
export function renderHTML(diagram, options = {}) {
  return renderHTMLTable(diagram, options)
}

// ---------------------------------------------------------------------------
// Calculate role group spans
// ---------------------------------------------------------------------------

function buildRoleGroupSpans(roles) {
  const spans = []
  let current = null

  for (const role of roles) {
    const groupLabel = role.group.at(-1) ?? ""
    if (!current || current.label !== groupLabel) {
      current = { label: groupLabel, count: 0 }
      spans.push(current)
    }
    current.count++
  }

  return spans
}

// ---------------------------------------------------------------------------
// HTML helper functions
// ---------------------------------------------------------------------------

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}