/**
 * RASCI — VS Code Extension Host
 *
 * Registers:
 *  - Language support (via package.json / contributes)
 *  - Command "rasci.showPreview"       — opens live preview beside the editor
 *  - Command "rasci.showPreviewToSide" — opens preview explicitly to the side
 *  - Auto-update on document changes
 *  - markdown-it plugin: renders ```rasci fences in the built-in Markdown preview
 *    (styles via contributes."markdown.previewStyles" -> media/rasci-preview.css)
 */

// @ts-check
"use strict"

const vscode = require("vscode")
const path   = require("path")

let parse
let validate
let renderHTML
let coreLoadError = null

try {
  ({ parse, validate, renderHTML } = require("../dist/rasci-core.cjs"))
}
catch (err) {
  coreLoadError = err
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/**
 * markdown-it plugin for the built-in Markdown preview.
 * Renders ```rasci fences as RASCI tables; all other fences fall through to 
 * the previous fence rule (syntax highlighting, Mermaid, ...)
 * @param {any} md - The Markdown-it instance to extend provided by VS Code
 * @returns {any} The extended Markdown-it instance
 */
function rasciMarkdownPlugin (md) {
  const fallback = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim().split(/\s+/)[0] !== "rasci")
      return fallback(tokens, idx, options, env, self)
    //  code-line + data-line keep editor and preview scroll in sync
    const line = token.map ? ` data-line="${token.map[0]}"` : ""
    const mode = getPreviewValidationMode(env?.currentDocument)
    return `<div class="rasci-preview code-line"${line}>` + renderFragment(token.content, mode) + `</div>\n`
  }
  return md
}

/** @param {vscode.ExtensionContext} context */
function activate (context) {
  const api = { extendMarkdownIt: md => rasciMarkdownPlugin(md) }

  if (coreLoadError) {
    vscode.window.showErrorMessage(
      "RASCI: failed to load extension core bundle (dist/rasci-core.cjs). Run 'npm run build' in vscode-extension, then reload VS Code."
    )
    return api
  }

  // one panel per document URI
  /** @type {Map<string, vscode.WebviewPanel>} */
  const panels = new Map()

  // -------------------------------------------------------------------------
  // Command: open preview
  // -------------------------------------------------------------------------

  const openPreview = (viewColumn) => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage("RASCI: no active editor")
      return
    }
    if (editor.document.languageId !== "rasci") {
      vscode.window.showWarningMessage("RASCI: active file is not a .rasci file")
      return
    }

    const uri   = editor.document.uri.toString()
    const title = path.basename(editor.document.fileName, ".rasci") + " — RASCI Preview"

    // reuse an existing panel for this document
    if (panels.has(uri)) {
      panels.get(uri).reveal(viewColumn)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      "rasciPreview",
      title,
      viewColumn ?? vscode.ViewColumn.Beside,
      {
        enableScripts:           true,
        retainContextWhenHidden: true,
        localResourceRoots:      [vscode.Uri.joinPath(context.extensionUri, "media")],
      }
    )

    panels.set(uri, panel)
    panel.onDidDispose(() => panels.delete(uri), null, context.subscriptions)

    // trigger the first render
    updatePanel(panel, editor.document, context.extensionUri)
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("rasci.showPreview",
      () => openPreview(vscode.ViewColumn.Beside)),
    vscode.commands.registerCommand("rasci.showPreviewToSide",
      () => openPreview(vscode.ViewColumn.Two))
  )

  // -------------------------------------------------------------------------
  // Auto-update on text changes
  // -------------------------------------------------------------------------

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const uri = event.document.uri.toString()
      if (!panels.has(uri)) return
      if (event.document.languageId !== "rasci") return
      updatePanel(panels.get(uri), event.document, context.extensionUri)
    })
  )

  // bring the matching panel to the front when switching editors
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!editor) return
      const uri = editor.document.uri.toString()
      if (!panels.has(uri)) return
      panels.get(uri).reveal(undefined, true)
    })
  )

  return api
}

// ---------------------------------------------------------------------------
// Shared rendering (panel + Markdown preview)
// ---------------------------------------------------------------------------

/**
 * Parses, validates and renders RASCI source to an HTML fragment
 * Parse and validation issues are rendered as inline blocks.
 * @param {string} source 
 * @param {"strict"|"warn"|"ignore"} [validationMode]
 * @returns {string} HTML fragment representing the rendered RASCI diagram and any validation issues
 */
function renderFragment (source, validationMode = "warn") {
  if (coreLoadError)
    return issueBlock("RASCI core not loaded", ["dist/rasci-core.cjs is missing or broken. Run 'npm run build' in vscode-extension, then reload VS Code."], "error")

  let content
  try {
    const diagram = parse(normalizePreviewSource(source))
    const report = validate(diagram)
    const hasErrors = report.errors.length > 0
    const hasWarnings = report.warnings.length > 0
    const hasInfos = report.infos.length > 0
    const hasIssues = hasErrors || hasWarnings || hasInfos
    const rendered = renderHTML(diagram, { showRoleGroups: true, showRoleLabels: true })

    if (hasErrors && validationMode === "strict") {
      content = issueBlock("Validation errors", report.errors, "error")
    }
    else if (hasIssues && validationMode === "warn") {
      const blocks = []
      if (hasErrors) blocks.push(issueBlock("Validation errors", report.errors, "error"))
      if (hasWarnings) blocks.push(issueBlock("Validation warnings", report.warnings, "warning"))
      if (hasInfos) blocks.push(issueBlock("Validation info", report.infos, "warning"))
      content = `${blocks.join("\n")}\n${rendered}`
    }
    else {
      content = rendered
    }
  }
  catch (e) {
    content = issueBlock("Parse error", [e.message], "error")
  }
  return content
}

// ---------------------------------------------------------------------------
// Panel rendering
// ---------------------------------------------------------------------------

/**
 * @param {vscode.WebviewPanel} panel
 * @param {vscode.TextDocument} document
 * @param {vscode.Uri} extensionUri
 */
function updatePanel (panel, document, extensionUri) {
  const source = document.getText()
  const title  = path.basename(document.fileName, ".rasci")
  const validationMode = getPreviewValidationMode(document.uri)
  const styleUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "rasci-preview.css")
  )
  panel.webview.html = buildWebviewHTML(source, title, validationMode, {
    styleUri:  styleUri.toString(),
    cspSource: panel.webview.cspSource
  })
}

/**
 * Parses the RASCI source and returns a complete webview HTML document.
 * Parse and validation errors are displayed inline.
 *
 * @param {string} source
 * @param {string} title
 * @param {"strict"|"warn"|"ignore"} validationMode
 * @param {{ styleUri: string, cspSource: string }} assets
 * @returns {string}
 */
function buildWebviewHTML (source, title, validationMode, assets) {
  let content = renderFragment(source, validationMode)

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${assets.cspSource} 'unsafe-inline'; script-src 'none';">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="${assets.styleUri}">
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size:   var(--vscode-font-size, 13px);
      background:  var(--vscode-editor-background, #1e1e1e);
      color:       var(--vscode-editor-foreground, #d4d4d4);
      padding:     1.5rem 2rem;
      margin:      0;
    }

    /* RASCI table — VS Code theme variables */
    .rasci-wrapper { overflow-x: auto; }
    .rasci-table {
      border-collapse: collapse;
      font-size:       12px;
      min-width:       400px;
      width:           100%;
    }
    .rasci-table th,
    .rasci-table td {
      border:      1px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
      padding:     4px 10px;
      text-align:  center;
      white-space: nowrap;
    }
    .rasci-task-header,
    .rasci-task-label { text-align: left; min-width: 160px; }
    .rasci-corner       { background: transparent; }
    .rasci-group-header {
      background:     var(--vscode-sideBar-background, rgba(128,128,128,0.12));
      font-weight:    500;
      font-size:      11px;
      letter-spacing: .04em;
      opacity:        .7;
    }
    .rasci-role-header {
      background:  var(--vscode-sideBar-background, rgba(128,128,128,0.08));
      font-weight: 500;
    }
    .rasci-task-label  { background: transparent; }
    .rasci-phase-header {
      background:  var(--vscode-sideBar-background, rgba(128,128,128,0.12));
      font-weight: 500;
      text-align:  left;
      padding:     3px 10px;
      opacity:     .85;
    }
    .rasci-attr {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      block-size: 1.9em;
      min-inline-size: 1.9em;
      margin: 0 .08em;
      border-radius: 100em;
      border: 1px solid transparent;
      box-sizing: border-box;
      line-height: 1;
      padding: 0.5em;
    }
    .rasci-cell  { font-weight: 500; font-size: 11px; }
    .rasci-empty { opacity: .3; }
    .rasci-R     { background: rgba(234,174,57,.18);  color: #d4aa44; border-color: var(--rasci-r-fg); }
    .rasci-A     { background: rgba(224,108,108,.18); color: #e06c6c; border-color: var(--rasci-a-fg); }
    .rasci-S     { background: rgba(80,200,120,.15);  color: #50c878; border-color: var(--rasci-s-fg); }
    .rasci-C     { background: rgba(86,156,214,.15);  color: #569cd6; border-color: var(--rasci-c-fg); }
    .rasci-I     { background: rgba(128,128,128,.12); color: #888;    border-color: var(--rasci-i-fg); }
    .rasci-link  {
      color:           var(--vscode-textLink-foreground, #3794ff);
      opacity:         .7;
      text-decoration: none;
      margin-left:     4px;
      font-size:       11px;
    }
    .rasci-link:hover { opacity: 1; }
  </style>
</head>
<body>
  <div class="rasci-preview">
  ${content}
  </div>
</body>
</html>`
}

function issueBlock (heading, messages, kind = "error") {
  const items = messages.map(m => `<li>${esc(m)}</li>`).join("\n      ")
  const cls = kind === "warning" ? "warning-block" : "error-block"
  return `<div class="${cls}">
    <strong>${esc(heading)}</strong>
    <ul>${items}</ul>
  </div>`
}

function esc (str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Keep preview parsing robust even when the bundled parser version lags.
 * Mirrors parser comment behavior: anything after %% on a line is ignored.
 *
 * @param {string} source
 * @returns {string}
 */
function normalizePreviewSource (source) {
  return String(source ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/%%.*$/, ""))
    .join("\n")
}

/**
 * @param {vscode.Uri | undefined} uri - resource scope; undefined falls back to the global/workspace settings
 * @returns {"strict"|"warn"|"ignore"}
 */
function getPreviewValidationMode (uri) {
  const cfg = vscode.workspace.getConfiguration("rasci", uri)
  const mode = String(cfg.get("preview.validationMode", "warn")).toLowerCase()
  if (mode === "strict" || mode === "warn" || mode === "ignore") return mode
  return "warn"
}

// ---------------------------------------------------------------------------

function deactivate () {}

module.exports = { activate, deactivate }
