/**
 * RASCI — VS Code Extension Host
 *
 * Registers:
 *  - Language support (via package.json / contributes)
 *  - Command "rasci.showPreview"       — opens live preview beside the editor
 *  - Command "rasci.showPreviewToSide" — opens preview explicitly to the side
 *  - Auto-update on document changes
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
} catch (err) {
  coreLoadError = err
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/** @param {vscode.ExtensionContext} context */
function activate(context) {

  if (coreLoadError) {
    vscode.window.showErrorMessage(
      "RASCI: failed to load extension core bundle (dist/rasci-core.cjs). Run 'npm run build' in vscode-extension, then reload VS Code."
    )
    return
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
      }
    )

    panels.set(uri, panel)
    panel.onDidDispose(() => panels.delete(uri), null, context.subscriptions)

    // trigger the first render
    updatePanel(panel, editor.document)
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
      updatePanel(panels.get(uri), event.document)
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
}

// ---------------------------------------------------------------------------
// Panel rendering
// ---------------------------------------------------------------------------

/**
 * @param {vscode.WebviewPanel} panel
 * @param {vscode.TextDocument} document
 */
function updatePanel(panel, document) {
  const source = document.getText()
  const title  = path.basename(document.fileName, ".rasci")
  panel.webview.html = buildWebviewHTML(source, title)
}

/**
 * Parses the RASCI source and returns a complete webview HTML document.
 * Parse and validation errors are displayed inline.
 *
 * @param {string} source
 * @param {string} title
 * @returns {string}
 */
function buildWebviewHTML(source, title) {
  let content

  try {
    const diagram = parse(source)
    const { valid, errors } = validate(diagram)

    if (!valid) {
      content = errorBlock("Validation errors", errors)
    } else {
      content = renderHTML(diagram, { showRoleGroups: true, showRoleLabels: true })
    }
  } catch (e) {
    content = errorBlock("Parse error", [e.message])
  }

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none';">
  <title>${esc(title)}</title>
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

    /* Force renderer table tokens to track VS Code theme classes.
       The renderer injects its own :root palette; body-level variables override it in the webview tree. */
    body.vscode-light,
    body.vscode-high-contrast-light {
      --rasci-border: #d0d7de;
      --rasci-bg-corner: #f6f8fa;
      --rasci-bg-header: #eef2f6;
      --rasci-bg-task: #ffffff;
      --rasci-text-primary: #24292f;
      --rasci-text-muted: #8c959f;
      --rasci-text-subtle: #57606a;
      --rasci-error: #cf222e;

      --rasci-r-bg: #fff8c5;
      --rasci-r-fg: #7d4e00;
      --rasci-a-bg: #ffebe9;
      --rasci-a-fg: #953800;
      --rasci-s-bg: #dafbe1;
      --rasci-s-fg: #116329;
      --rasci-c-bg: #ddf4ff;
      --rasci-c-fg: #0a3069;
      --rasci-i-bg: #f6f8fa;
      --rasci-i-fg: #57606a;
    }

    body.vscode-dark,
    body.vscode-high-contrast {
      --rasci-border: #3d444d;
      --rasci-bg-corner: #161b22;
      --rasci-bg-header: #1f2630;
      --rasci-bg-task: #0d1117;
      --rasci-text-primary: #e6edf3;
      --rasci-text-muted: #9da7b3;
      --rasci-text-subtle: #b1bac4;
      --rasci-error: #ff7b72;

      --rasci-r-bg: #4f3b00;
      --rasci-r-fg: #f2cc60;
      --rasci-a-bg: #5a1e17;
      --rasci-a-fg: #ffb3a7;
      --rasci-s-bg: #0f3a20;
      --rasci-s-fg: #7ee787;
      --rasci-c-bg: #0c2d4a;
      --rasci-c-fg: #79c0ff;
      --rasci-i-bg: #21262d;
      --rasci-i-fg: #c9d1d9;
    }

    .error-block {
      border-left:   3px solid var(--vscode-errorForeground, #f44);
      padding:       0.75rem 1rem;
      background:    var(--vscode-inputValidation-errorBackground, rgba(255,68,68,0.08));
      border-radius: 3px;
      font-size:     12px;
    }
    .error-block strong {
      display:       block;
      margin-bottom: 0.4rem;
      color:         var(--vscode-errorForeground, #f44);
    }
    .error-block ul { margin: 0; padding-left: 1.2rem; }
    .error-block li {
      font-family: var(--vscode-editor-font-family, monospace);
      margin: 2px 0;
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
  ${content}
</body>
</html>`
}

function errorBlock(heading, messages) {
  const items = messages.map(m => `<li>${esc(m)}</li>`).join("\n      ")
  return `<div class="error-block">
    <strong>${esc(heading)}</strong>
    <ul>${items}</ul>
  </div>`
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ---------------------------------------------------------------------------

function deactivate() {}

module.exports = { activate, deactivate }