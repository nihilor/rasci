# RASCI DSL for VS Code

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/nihilor.rasci-language)](https://marketplace.visualstudio.com/items?itemName=nihilor.rasci-language)
[![VS Code Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/nihilor.rasci-language)](https://marketplace.visualstudio.com/items?itemName=nihilor.rasci-language)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/nihilor/rasci/blob/main/LICENSE)

Write RASCI responsibility matrices as plain text and get immediate visual feedback while you edit.

This extension provides language support and live preview for the RASCI DSL.

## Features

- Syntax highlighting for `.rasci` and `.rasci-rules`
- Markdown fenced code block highlighting for ` ```rasci `
- Live HTML preview for RASCI files
- Preview commands in Command Palette and editor title bar
- Auto-refresh preview on document changes
- Inline parse and validation errors in the preview panel

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

## RASCI in Markdown

RASCI code fences are highlighted in Markdown files:

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

- Preview commands are active only for RASCI editors.
- The extension keeps one preview panel per RASCI document.
- Preview rendering uses the bundled core; run a build when developing locally.

## Development

Developer notes: [README.developers.md](README.developers.md)

From `vscode-extension/`:

```bash
npm install
npm run build
```

Launch Extension Development Host in VS Code (`F5`) and open a `.rasci` file.

## Packaging and Publishing

Create a `.vsix` package:

```bash
npm run package
```

This runs build + `vsce package`.

## Related

- Main project repository: https://github.com/nihilor/rasci
- RASCI live editor: https://nihilor.github.io/rasci/

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

