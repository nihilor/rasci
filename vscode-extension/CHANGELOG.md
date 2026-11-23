# Changelog

All notable changes to the RASCI DSL extension for VS Code are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-23

### Added

- Rendering of ` ```rasci ` code blocks in VS Code's built-in Markdown preview via a markdown-it plugin. All other code blocks are left untouched.
- `rasci.preview.validationMode` applies to the Markdown preview as well, resolved per document.
- Scroll sync between editor and Markdown preview for RASCI blocks.
- Theme-aware stylesheet `media/rasci-preview.css`, generated at build time from the core stylesheet `rasci-table.css` and the VS Code theme layer `styles/preview-theme.css`.

### Changed

- The preview panel and the Markdown preview share one rendering path, so parse errors, validation issues and the validation mode behave the same in both.
- The preview panel loads the shared stylesheet. Theme overrides and issue blocks moved from inline styles into `styles/preview-theme.css`.
- Issue block styles are scoped under `.rasci-preview` to avoid clashes with other extensions in the Markdown preview.
- If the core bundle fails to load, previews show an error block with a hint to run `npm run build`.

## [0.2.0] - 2026-06-10

### Added

- Setting `rasci.preview.validationMode` with the modes `warn` (default), `strict` and `ignore`.
- Validation messages grouped by severity: errors, warnings, infos.
- Dark mode for the preview panel, following the VS Code theme.

### Changed

- Comments (`%%`) are stripped deterministically before parsing.
- Enhanced rendering of the preview table.
- Packaging excludes build inputs via `.vscodeignore`.

## [0.1.7] - 2026-06-09

### Changed

- Detailed package information for the Marketplace.

## [0.1.5] - 2026-06-08

### Added

- Syntax highlighting for `.rasci` and `.rasci-rules` files.
- Highlighting for ` ```rasci ` code blocks in Markdown.
- Live HTML preview panel with auto-refresh on document changes.
- Commands `RASCI: Show Preview` and `RASCI: Show Preview to the Side`, keybinding `Cmd+Shift+V` / `Ctrl+Shift+V`.
