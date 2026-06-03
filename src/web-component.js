import { parse, validate } from "./parser.js"
import { renderHTMLStyleTag, renderHTMLTable } from "./renderer.html.js"

class RasciTableElement extends HTMLElement {
  static get observedAttributes() {
    return ["no-role-groups", "no-role-labels"]
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
    }
  }

  render() {
    const source = this.source.trim()

    if (!source) {
      this.shadowRoot.innerHTML = `${renderHTMLStyleTag()}<div class="rasci-wrapper"><p>No RASCI source provided.</p></div>`
      return
    }

    try {
      const diagram = parse(source)
      const { valid, errors } = validate(diagram)
      if (!valid) {
        throw new Error(errors.join("\n"))
      }

      this.shadowRoot.innerHTML = `${renderHTMLStyleTag()}${renderHTMLTable(diagram, this.options)}`
    } catch (error) {
      const msg = error?.message ?? String(error)
      this.shadowRoot.innerHTML = `${renderHTMLStyleTag()}<div class="rasci-wrapper"><pre style="white-space: pre-wrap; color: #cf222e;">${escapeHTML(msg)}</pre></div>`
    }
  }
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
