import { parse, validate } from "./parser.js"
import { renderHTMLTable } from "./renderer.html.js"

const tableCssHref = new URL("./rasci-table.css", import.meta.url).href

class RasciTableElement extends HTMLElement {
  static get observedAttributes() {
    return ["no-role-groups", "no-role-labels", "show-aliases-only", "validation-mode"]
  }

  constructor() {
    super()
    this.attachShadow({ mode: "open" })
    this._observer = new MutationObserver(() => this.render())
  }

  connectedCallback() {
    this._observer.observe(this, { childList: true, characterData: true, subtree: true })
    this.render()
  }

  disconnectedCallback() {
    this._observer.disconnect()
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render()
  }

  get source() {
    return this.textContent ?? ""
  }

  get options() {
    return {
      showRoleGroups: !this.hasAttribute("no-role-groups"),
      showRoleLabels: !this.hasAttribute("no-role-labels"),
      validationMode: this.validationMode,
    }
  }

  get validationMode() {
    const mode = (this.getAttribute("validation-mode") ?? "strict").toLowerCase()
    if (mode === "warn" || mode === "ignore" || mode === "strict") return mode
    return "strict"
  }

  render() {
    const source = normalizeSource(this.source)
    const tableStyle = `<link rel="stylesheet" href="${tableCssHref}">`

    if (!source.trim()) {
      this.shadowRoot.innerHTML = `${tableStyle}<div class="rasci-wrapper"><p>No RASCI source provided.</p></div>`
      return
    }

    try {
      const options = this.options
      const diagram = parse(source)
      const report = validate(diagram)
      const hasErrors = report.errors.length > 0
      const hasIssues = report.errors.length > 0 || report.warnings.length > 0 || report.infos.length > 0

      if (hasErrors && options.validationMode === "strict") {
        throw new Error(report.errors.join("\n"))
      }

      const warning = hasIssues && options.validationMode === "warn"
        ? validationBlock(report)
        : ""

      this.shadowRoot.innerHTML = `${tableStyle}${warning}${renderHTMLTable(diagram, options)}`
    } catch (error) {
      const msg = error?.message ?? String(error)
      this.shadowRoot.innerHTML = `${tableStyle}<div class="rasci-wrapper"><pre style="white-space: pre-wrap; color: #cf222e;">${escapeHTML(msg)}</pre></div>`
    }
  }
}

function validationBlock(report) {
  const lines = []

  if (report.errors.length) {
    const items = report.errors.map(err => `<li>${escapeHTML(err)}</li>`).join("\n")
    lines.push(`<strong style="display:block; margin-bottom:.35rem; color:#953800;">Validation errors</strong><ul style="margin:0 0 .5rem 0; padding-left:1.2rem;">${items}</ul>`)
  }

  if (report.warnings.length) {
    const items = report.warnings.map(warn => `<li>${escapeHTML(warn)}</li>`).join("\n")
    lines.push(`<strong style="display:block; margin-bottom:.35rem;">Validation warnings</strong><ul style="margin:0; padding-left:1.2rem;">${items}</ul>`)
  }

  if (report.infos.length) {
    const items = report.infos.map(info => `<li>${escapeHTML(info)}</li>`).join("\n")
    lines.push(`<strong style="display:block; margin:.5rem 0 .35rem 0;">Validation info</strong><ul style="margin:0; padding-left:1.2rem;">${items}</ul>`)
  }

  return `<div class="rasci-wrapper"><div style="margin-bottom: .75rem; border-left: 3px solid #d29922; padding: .6rem .8rem; background: rgba(210,153,34,.12);">${lines.join("")}</div></div>`
}

/** Essential, otherwise we get in trouble */
function normalizeSource(raw) {
  const text = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")

  const lines = text.split("\n")
  const startAt = lines.findIndex(line => {
    const t = line.trim()
    return t === "%%rasci" || t === "roles:" || t === "tasks:"
  })

  const workLines = startAt >= 0 ? lines.slice(startAt) : lines

  while (workLines.length && !workLines[0].trim()) workLines.shift()
  while (workLines.length && !workLines[workLines.length - 1].trim()) workLines.pop()

  const nonEmpty = workLines.filter(line => line.trim())
  if (!nonEmpty.length) return ""

  const minIndent = Math.min(...nonEmpty.map(line => (line.match(/^ */)?.[0].length ?? 0)))
  return workLines.map(line => line.slice(Math.min(minIndent, line.length))).join("\n")
}

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
}

if (!customElements.get("rasci-table")) {
  customElements.define("rasci-table", RasciTableElement)
}

export { RasciTableElement }
