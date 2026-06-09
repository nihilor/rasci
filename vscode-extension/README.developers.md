# vscode-extension Repository (Developer Notes)

Minimal setup for contributors.

## Prerequisites

- Node.js 18+
- npm
- VS Code

## Local Setup

1. Install dependencies:
   - `npm install`
2. Build extension assets:
   - `npm run build`

## Development Loop

1. Open this folder in VS Code.
2. Press F5 to launch an Extension Development Host.
3. In the host window, open a `.rasci` file and run preview commands.

## Packaging

- Build and package VSIX:
  - `npm run package`

## Generated Artifacts

- Grammar files in `syntaxes/`
- Runtime core bundle in `dist/rasci-core.cjs`

## Common Fixes

- Command not found for preview:
  - Ensure `npm run build` succeeded.
  - Reload the window after reinstalling/updating the extension.
