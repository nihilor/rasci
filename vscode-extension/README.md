# RASCI DSL for VS Code

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/nihilor/rasci/blob/main/LICENSE)

Write RASCI responsibility matrices as plain text and get immediate visual feedback while you edit.

This extension provides language support and live preview for the RASCI DSL, both for `.rasci` files and for ` ```rasci ` code blocks in Markdown.

## Features

- Syntax highlighting for `.rasci` and `.rasci-rules`
- Markdown fenced code block highlighting for ` ```rasci `
- Rendering of ` ```rasci ` code blocks in VS Code's built-in Markdown preview
- Live HTML preview for RASCI files
- Preview commands in Command Palette and editor title bar
- Auto-refresh preview on document changes
- Inline parse errors and configurable validation handling in the preview panel and the Markdown preview

## Quick Start

1. Create or open a `.rasci` file.
2. Open the Command Palette and run:
   - `RASCI: Show Preview`
   - `RASCI: Show Preview to the Side`
3. Keep editing your DSL file and watch the preview update automatically.

## Commands

- `RASCI: Show Preview`
- `RASCI: Show Preview to the Side`

## Keybinding

- macOS: `Cmd+Shift+V`
- Windows/Linux: `Ctrl+Shift+V`

Available when the active editor language is `rasci`.

## Settings

- `rasci.preview.validationMode`:
  - `warn` (default): render preview and show validation warnings
  - `strict`: show validation errors only, skip rendering
  - `ignore`: render preview without validation messages

Parse errors always stop rendering.

## RASCI in Markdown

RASCI code fences are highlighted in the Markdown editor and rendered as a table in VS Code's built-in Markdown preview (`Markdown: Open Preview to the Side`, `Cmd+K V` / `Ctrl+K V`):

````markdown
```rasci
roles:
  PO "Product Owner"
  DEV "Developer"

tasks:
  "Implement feature":
    PO[A] DEV[R]
```
````

How it works:

- Only fences with the info string `rasci` are rendered. All other code blocks, including Mermaid and other extensions' fences, stay untouched.
- The setting `rasci.preview.validationMode` applies to the Markdown preview as well. Parse and validation issues appear inline at the position of the code block.
- Colors follow the active VS Code theme (light, dark, high contrast).
- Scroll sync between editor and preview works for RASCI blocks like for any other block.

To show the source instead of the rendered table, disable the extension for the workspace or use a different info string, such as ` ```text `.

## Install

### Marketplace

Install from the VS Code Marketplace:

- https://marketplace.visualstudio.com/items?itemName=nihilor.rasci-language

Or search for `RASCI DSL` in VS Code Extensions.

### Manual (VSIX)

1. Open Extensions view.
2. Select `...` (more actions).
3. Choose `Install from VSIX...`.
4. Select the `.vsix` file.

## Limitations

- Preview commands are active only for RASCI editors. Markdown files use VS Code's own Markdown preview.
- The extension keeps one preview panel per RASCI document.
- Preview rendering uses the bundled core; run a build when developing locally.
- Rendering in Markdown applies to VS Code's built-in Markdown preview only. Other Markdown renderers (GitHub, static site generators) need their own integration of the `rasci` npm package.

## Development

Developer notes: [README.developers.md](README.developers.md)

From `vscode-extension/`:

```bash
npm install
npm run build
```

Launch Extension Development Host in VS Code (`F5`) and open a `.rasci` file, or a Markdown file with a ` ```rasci ` block and its Markdown preview.

## Packaging and Publishing

Create a `.vsix` package:

```bash
npm run package
```

This runs build + `vsce package`.

## Related

- Main project repository: https://github.com/nihilor/rasci
- RASCI live editor: https://nihilor.github.io/rasci/

## Live Preview Details

Beyond this VS Code preview panel, the main repository ships a browser live preview site and component demo:

- Live editor page: https://nihilor.github.io/rasci/
- Live editor source: [../docs/index.html](../docs/index.html)
- Web component showcase: https://nihilor.github.io/rasci/web-component-demo.html
- Showcase source: [../docs/web-component-demo.html](../docs/web-component-demo.html)

The browser site uses docs-local module copies of the parser and renderers:

- [../docs/src/parser.js](../docs/src/parser.js)
- [../docs/src/renderer.html.js](../docs/src/renderer.html.js)
- [../docs/src/renderer.markdown.js](../docs/src/renderer.markdown.js)

Those docs modules are synced from the main [../src](../src) directory via the docs build flow.

## License

MIT License

Copyright (c) 2026 Mark Lubkowitz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

