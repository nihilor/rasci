/**
 * RASCI DSL — Markdown Renderer (GFM)
 *
 * Input:   RasciDiagram (IR from parser.js)
 * Output:  Markdown string (GitHub Flavored Markdown)
 *
 * Features:
 *  - Task groups as ## headings
 *  - Role groups as column grouping (comment line above the header)
 *  - desc as additional column, only if at least one task has a description (otherwise this would add unnecessary clutter)
 *  - link as footnote reference at the end of the document
 *  - Cell alignment: centered for RASCI columns, left-aligned for task column
 */

import { flatRoles } from "./parser.js"
import { normalize } from "./renderer.html.js"

/**
 * @param {import("./parser.js").RasciDiagram} diagram
 * @param {{ title?: string }} [options]
 * @returns {string}
 */
export function renderMarkdown(diagram, options = {}) {
  const { title = "RASCI-Matrix" } = options
  const matrix = normalize(diagram)
  const { roles, groups } = matrix

  const lines  = []
  const notes  = [] // Footnotes: [label, url]
  let   noteId = 0

  const footnote = (url) => {
    noteId++
    notes.push([noteId, url])
    return `[^${noteId}]`
  }

  // ------------------------------------------------------------------
  // Document title
  // ------------------------------------------------------------------
  lines.push(`# ${title}`, "")

  // ------------------------------------------------------------------
  // Legend
  // ------------------------------------------------------------------
  lines.push(
    "**R** Responsible · **A** Accountable · **S** Supportive · **C** Consulted · **I** Informed",
    ""
  )

  // ------------------------------------------------------------------
  // Role groups overview (if available)
  // ------------------------------------------------------------------
  const roleGroupSpans = buildRoleGroupSpans(roles)
  const hasRoleGroups  = roleGroupSpans.some(s => s.label)

  if (hasRoleGroups) {
    lines.push("### Roles")
    for (const span of roleGroupSpans) {
      if (!span.label) continue
      const members = span.roles.map(r => `**${r.alias}** ${r.label}`).join(", ")
      lines.push(`- **${span.label}:** ${members}`)
    }
    // Flat roles without grouping (if any)
    const ungrouped = roles.filter(r => !r.group.length)
    if (ungrouped.length) {
      lines.push(`- ${ungrouped.map(r => `**${r.alias}** ${r.label}`).join(", ")}`)
    }
    lines.push("")
  }

  // ------------------------------------------------------------------
  // Column widths (global, for consistent alignment)
  // ------------------------------------------------------------------
 
  const taskColW = Math.max(
    10,
    ...groups.flatMap(g => g.tasks.map(row => row.task.label.length))
  )
  const roleColW = Math.max(
    3,
    ...roles.map(r => r.alias.length)
  )
  const descColW = Math.max(
    4, // "Desc"
    ...groups.flatMap(g =>
      g.tasks.map(row => (row.task.meta.desc ?? "").length)
    )
  )
 
  const pad  = (str, w) => str.padEnd(w, " ")
  const cpad = (str, w) => str.padStart(Math.floor((w + str.length) / 2), " ").padEnd(w, " ")

  // ------------------------------------------------------------------
  // Groups and rows
  // ------------------------------------------------------------------

  for (const group of groups) {
    if (group.label) {
      const groupLink = group.meta.link ? ` [↗](${group.meta.link})` : ""
      const groupDesc = group.meta.desc ? `\n_${group.meta.desc}_` : ""
      lines.push(`## ${group.label}${groupLink}${groupDesc}`, "")
    }
 
    // Description column only if at least one task has a description (otherwise this would add unnecessary clutter)
    const hasDesc = group.tasks.some(row => row.task.meta.desc)
 
    const headerRow = [
      `| ${pad("Task", taskColW)} `,
      ...(hasDesc ? [`| ${pad("Description", descColW)} `] : []),
      ...roles.map(r => `| ${cpad(r.alias, roleColW)} `),
      "|",
    ].join("")
 
    const sepRow = [
      `| :${"-".repeat(taskColW - 1)} `,
      ...(hasDesc ? [`| :${"-".repeat(descColW - 1)} `] : []),
      ...roles.map(() => `| :${"-".repeat(Math.max(1, roleColW - 2))}: `),
      "|",
    ].join("")
 
    lines.push(headerRow, sepRow)
 
    for (const row of group.tasks) {
      const { task, cells } = row
 
      // Task Label and optional link as footnote
      let taskLabel = task.label
      if (task.meta.link) taskLabel += footnote(task.meta.link)
 
      const taskCell = `| ${pad(taskLabel, taskColW)} `
      const descCell = hasDesc
        ? `| ${pad(task.meta.desc ?? "", descColW)} `
        : ""
      const rascis = roles.map(role => {
        const attrs = cells.get(role.alias) ?? []
        const text  = attrs.join(",") || " "
        return `| ${cpad(text, roleColW)} `
      })
 
      lines.push([taskCell, descCell, ...rascis, "|"].join(""))
    }
 
    lines.push("")
  }

  // ------------------------------------------------------------------
  // Footnotes
  // ------------------------------------------------------------------
  if (notes.length) {
    lines.push("---", "")
    for (const [id, url] of notes) {
      lines.push(`[^${id}]: ${url}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Helper function: Role group spans (with role objects)
// ---------------------------------------------------------------------------

function buildRoleGroupSpans(roles) {
  const spans = []
  let current = null
  for (const role of roles) {
    const groupLabel = role.group.at(-1) ?? ""
    if (!current || current.label !== groupLabel) {
      current = { label: groupLabel, roles: [], count: 0 }
      spans.push(current)
    }
    current.roles.push(role)
    current.count++
  }
  return spans
}