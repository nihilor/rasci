# rasci

A parser, renderer, and CLI for the **RASCI DSL**. RASCI DSL is a lightweight text format for
Responsibility Assignment Matrices. Write your RASCI matrix as plain text, render
it as HTML, Markdown, or JSON.

```rasci
roles:
  PO  "Product Owner"
  DEV "Developer"

tasks:
  "Implement feature":
    PO[A] DEV[R]
```

If you want to try it in the browser, check out the [web component](https://nihilor.github.io/rasci/web-component-demo.html)
for embedding examples and the [RASCI Live Editor](https://nihilor.github.io/rasci/) for quick testing and sharing.

[![Socket Badge](https://badge.socket.dev/npm/package/rasci/0.2.0)](https://badge.socket.dev/npm/package/rasci/0.2.0)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/nihilor/rasci/blob/main/LICENSE)
[![npm version](https://badge.fury.io/js/rasci.svg)](https://badge.fury.io/js/rasci)



## Why

RASCI or RACI matrices are usually maintained as tables or spreadsheets. These formats lack semantic
structure, are difficult to maintain, and do not integrate well with code repositories or other tools.
Treating a RASCI matrix as a data structure rather than a visual artifact allows it to be versionable,
reviewable, validateable, diffable, and renderable on demand for different contexts.

Validation is a key benefit: the parser can check for common issues like undeclared roles, missing
accountabilities, and inconsistent assignments. This helps maintain the integrity of the RASCI matrix as
a source of truth for team responsibilities. Also this benefits companies with strict compliance requirements,
where an incorrect RASCI/RACI matrix could lead to audit failures or legal issues.

## Installation

Just clone the repository or install the package from `npm` locally or globally:

```shell
# locally in the project, during development
npm install
```

```shell
# globally on the system, for usage
npm install -g .
```

> [!NOTE]
> Requires Node.js ≥ 18.

## Contents

- [Why](#why)
- [Installation](#installation)
- [How](#how)
  - [Examples](#examples)
  - [Multi format example](#multi-format-example)
- [Syntax reference](#syntax-reference)
  - [Roles](#roles)
  - [Tasks](#tasks)
  - [Metadata](#metadata)
  - [Assignments](#assignments)
- [Output formats](#output-formats)
- [Web component](#web-component)
- [Live preview website](#live-preview-website)
- [RASCI legend](#rasci-legend)

## How

Install the package globally, then run the `rasci` command with an input file and options:

```bash
rasci <input.rasci> [options]
```

| Option | Description | Default |
| :--- | :--- | :--- |
| `-f, --format <html\|markdown\|json>` | Output format | `html` |
| `-o, --output <file>` | Output file | stdout |
| `-t, --title <text>` | Document title | filename without extension |
| `--no-role-groups` | Suppress role group header row | — |
| `--no-role-labels` | Suppress role name tooltips | — |
| `-h, --help` | Show help | — |

### Examples

```bash
# Render to HTML (default)
rasci matrix.rasci -o matrix.html

# Render to Markdown
rasci matrix.rasci -f markdown -o matrix.md

# Export to JSON, pipe into jq
rasci matrix.rasci -f json | jq '.matrix[] | select(.group == "Discovery")'

# Render without role group headers
rasci matrix.rasci -f html --no-role-groups -o matrix.html
```

### Multi format example

This renders `example/example.rasci` to [`example/example.html`](example/example.html), [`example/example.md`](example/example.md), and [`example/example.json`](example/example.json) so you can inspect the outputs side by side. Run it from the project root:

```bash
npm run example
```

The full example from `example/example.rasci` looks like this:

```rasci
%%rasci

roles:
  PO  "Product Owner"
  PM  "Project Manager"
  "Stakeholder"
  group "Engineering":
    FE  "Frontend Engineer"
    BE  "Backend Engineer"
    group "Platform":
      OPS "Operations"
      SEC "Security"

tasks:
  group "Discovery":
    desc: "Clarify Requirements and Constraints"
    link: "https://nihilor.github.io/rasci"

    T01 "Collect requirements":
      desc: "Stakeholder interviews and documentation"
      PO[A] PM[R] FE[C] BE[C] Stakeholder[I]

    "Analyze market":
      PM[R] PO[A] Stakeholder[C]

  group "Realization":
    T02 "Design architecture":
      link: "https://github.com/nihilor/rasci"
      BE[R] FE[R] PO[A] SEC[C] OPS[C]

    T03 "Prepare deployment":
      OPS[R] BE[S] SEC[C] PM[A] Stakeholder[I]

  T04 "Approve release":
    PO[A,R] PM[C] Stakeholder[I]
```

The rendered output can look like this:

![Example RASCI Matrix](example/example.png)

## Syntax reference

A RASCI file has two required top-level sections: `roles:` and `tasks:`.
Comments start with `%%` and are stripped before parsing.

```rasci
%%rasci

roles:
  ...

tasks:
  ...
```

Indentation matters: use **2 spaces per level**. Tabs are not supported.
If you want the formal grammar, see [standard/rasci.ebnf](standard/rasci.ebnf).

The RASCI DSL was specifically designed to be human-friendly and writable in plain text, with a focus on readability
and ease of maintenance. The syntax is intentionally minimalistic, avoiding unnecessary punctuation and boilerplate,
while still being expressive enough to capture the structure and semantics of RASCI matrices.

### Roles

Roles define the columns of the matrix. Each role has an optional alias and a label.
The alias is the short name you use in assignments. The label is the full display name.
If you provide an alias, the label is shown as a tooltip.

```rasci
roles:
  PO  "Product Owner"       %% alias + label
  "Stakeholder"             %% no alias — label is used as-is
```

#### Alias rules

- Pattern: `[A-Z][A-Z0-9_]*`
- If omitted, the label string is used verbatim as the alias.
- For multi-word labels without an alias, i.e. `"Product Owner"`, the full string
  must be written in assignments (`"Product Owner"[C]`). A short alias is
  recommended for multi-word roles.

#### Role groups

Roles can be organised into named groups, which are rendered as spanning column
headers above the alias row. Groups nest arbitrarily.

```rasci
roles:
  PO  "Product Owner"
  PM  "Project Manager"
  group "Engineering":
    FE  "Frontend Engineer"
    BE  "Backend Engineer"
    group "Platform":
      OPS "Operations"
      SEC "Security"
```

Groups only affect how column headers are rendered. They do not change assignment semantics.

### Tasks

Tasks define the rows of the matrix. Each task has an optional **id**, a **label**, and
one or more [assignments](#assignments).

```rasci
tasks:
  T01 "Gather requirements":    %% explicit id
    PO[A] PM[R] Stakeholder[I]

  "Analyse market":             %% no id — slug derived: analyse_market
    PM[R] PO[A] Stakeholder[C]
```

For readability, tasks can be separated by blank lines.

#### Task ID rules

- Pattern: `[A-Z][A-Z0-9_]*`
- If omitted, the id is derived from the label: lowercased, spaces replaced
  with `_`, non-alphanumeric characters stripped, sometimes called a "slug".
  For example, `"Product Owner"` becomes `product_owner`.
- The id is exposed in JSON export and used in Markdown descriptions; it is
  not rendered in the HTML or Markdown table.

#### Task groups

Tasks can be organised into named groups, rendered as full-width separator rows
in the table body. Groups support [metadata](#metadata).

```rasci
tasks:
  group "Discovery":
    desc: "Clarify Requirements and Constraints"
    link: "https://nihilor.github.io/rasci"

    T01 "Gather requirements":
      PO[A] PM[R] FE[C] BE[C] Stakeholder[I]

    "Analyze market":
      PM[R] PO[A] Stakeholder[C]

  group "Implementation":
    T02 "Design architecture":
      BE[R] FE[R] PO[A] SEC[C] OPS[C]
```

Tasks at the top level of `tasks:` (outside any group) are collected into
implicit unlabelled groups and rendered without a separator row.

> [!HINT]
> For better readability, you can use explicit groups even for single tasks or small sets of tasks,
> as in the example above. This also allows you to add metadata to the group. If you place a task without a group
> at the end of the table, while other tasks are grouped, it will be rendered in a separate unlabelled group at the end, which may look odd.

### Metadata

Both tasks and task groups accept optional metadata fields, written as
indented key–value pairs immediately after the label line and before
any assignments or child items.

| Key | Rendered as |
| :--- | :--- |
| `desc` | Tooltip on the task or group label cell |
| `link` | Inline ↗ anchor next to the label |

```rasci
tasks:
  group "Discovery":
    desc: "Clarify Requirements and Constraints"       %% tooltip on group row
    link: "https://nihilor.github.io/rasci"            %% ↗ link on group row

    T01 "Gather requirements":
      desc: "Stakeholder interviews"                   %% tooltip on task row
      link: "https://github.com/nihilor/rasci"         %% ↗ link on task row
      PO[A] PM[R] Stakeholder[I]
```

If a description is provided for a task group, is rendered as a tooltip on the group separator row.
If a link is provided, an inline anchor is rendered next to the group label, linking to the specified URL.

### Assignments

Assignments map roles to RASCI values. They are written on one or more
indented lines after the task's metadata.

```rasci
ALIAS[RASCI]
```

Multiple assignments on the same line are separated by spaces:

```rasci
PO[A] PM[R] FE[C] BE[C] Stakeholder[I]
```

Multiple RASCI values for a single role are comma-separated inside the
brackets:

```rasci
PO[A,R]   %% Product Owner is both Accountable and Responsible
```

The cell is coloured by the **first** attribute, it multi attributes are assigned. Every alias must be declared
in the `roles:` section; undeclared aliases are a validation error.

## Output formats

The CLI currently supports three output formats: HTML, Markdown, and JSON.
You choose the format with `-f, --format`.

### HTML

A self-contained `<table>` with embedded CSS. Role group headers span their
respective columns; task group headers span all columns. RASCI cells are
colour-coded. No external dependencies.

```bash
rasci matrix.rasci -f html -o matrix.html
```

### Markdown (GFM)

A GitHub Flavored Markdown document. Task groups become `##` headings;
role groups are listed in a `### Roles` section at the top. Task links
become numbered footnotes at the end of the document.

```bash
rasci matrix.rasci -f markdown -o matrix.md
```

### JSON

A structured export with three keys:

```jsonc
{
  "roles":  [ /* flat list of all roles with group path */ ],
  "tasks":  [ /* flat list of all tasks with assignments */ ],
  "matrix": [ /* one entry per task, group label included */ ]
}
```

The `matrix` array is the most convenient entry point for downstream
tooling: each entry contains the group name, task id and label, metadata,
and a map of `alias → [attrs]` for all non-empty cells.

```bash
rasci matrix.rasci -f json -o matrix.json
```

## Web component

You can also render a RASCI matrix directly in the browser with the custom element
`<rasci-table>`, registered by [src/rasci-table.js](src/rasci-table.js).

### Usage

```html
<link rel="stylesheet" href="./src/rasci-table.css">
<script type="module" src="./src/rasci-table.js"></script>

<rasci-table no-role-labels>
%%rasci

roles:
  PO "Product Owner"
  "Stakeholder"

tasks:
  "Collect requirements":
    PO[A] "Stakeholder"[I]
</rasci-table>
```

### Supported attributes

- `no-role-groups`: hides grouped role header row
- `no-role-labels`: hides role-label tooltips in column headers

The element reads the RASCI DSL from its text content, parses it with
[src/parser.js](src/parser.js), validates it, and renders the table via a
table-only renderer path in [src/renderer.html.js](src/renderer.html.js).

It also ships with a default stylesheet in [src/rasci-table.css](src/rasci-table.css).
Use it as-is, override parts of it, or leave it out entirely if you want to style everything yourself.

## Live preview website

A browser-only live editor is available in [docs/index.html](docs/index.html).
There is also an interactive web component showcase in [docs/web-component-demo.html](docs/web-component-demo.html).
For GitHub Pages compatibility it loads browser modules from [docs/src/parser.js](docs/src/parser.js),
[docs/src/renderer.html.js](docs/src/renderer.html.js), and [docs/src/renderer.markdown.js](docs/src/renderer.markdown.js).
These files are synced from `src/` via `npm run build:docs`.

The repository includes [docs/.nojekyll](docs/.nojekyll), so GitHub Pages serves the site without Jekyll/theme processing.

To run it locally, start the HTTP server:

```bash
npm run live-editor
```

Afterwards open `http://localhost:4173/docs/index.html` in your web browser or click the link in the terminal output.

## RASCI legend

| Value | Name | Meaning |
| :--- | :--- | :--- |
| **R** | Responsible | Does the work |
| **A** | Accountable | Ultimately answerable; approves the result |
| **S** | Supportive | Provides resources or assistance |
| **C** | Consulted | Input sought before or during; two-way communication |
| **I** | Informed | Notified after the fact; one-way communication |

A task should have exactly one **A**. **R** may be shared across roles.
**S**, **C**, and **I** are informational and do not imply decision authority.

## Todo

- [ ] Add i18n support for role labels, group labels, task headers, etc.
- [ ] Add interface to extend the validator with custom rules (e.g. "every task must have at least one R", "no role can be both R and A for the same task", etc.)
- [ ] Add examples for custom validation rules in the documentation, in the live editor, and for CI and linting use cases.
- [x] Provide a web component for live preview and embedding in documentation sites.
- [x] Add live preview website for testing and sharing RASCI diagrams
- [x] Add documentation and examples
- [x] Add support for comments in the DSL
- [x] Add support for multi-line task descriptions
- [x] Add support for role aliases in the DSL (e.g. "R: Responsible (R1, R2)", "A: Accountable (A1, A2)", etc.)
- [x] Add CLI options for customizing the output (e.g. show/hide role labels, role group headers, etc.)

## Feature Ideas

- [ ] Provide an API for programmatic usage in JavaScript projects.
- [ ] Add support for custom cell styles (e.g. colors, icons, etc.)
- [ ] Add support for exporting to other formats (e.g. Excel, CSV, etc.)
- [ ] Add tests for the parser and renderer
- [ ] Add error handling and validation for the input DSL

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
