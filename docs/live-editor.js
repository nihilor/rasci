import { parse, validate, flatRoles, flatTasks } from "./src/parser.js";
import { renderHTML, normalize } from "./src/renderer.html.js";
import { renderMarkdown } from "./src/renderer.markdown.js";

const STARTER = `%%rasci

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
`;

const input = document.getElementById("input");
const lineNumbers = document.getElementById("line-numbers");
const status = document.getElementById("status");
const htmlFrame = document.getElementById("html-frame");
const markdownOutput = document.getElementById("markdown-output");
const jsonOutput = document.getElementById("json-output");
const tabs = [...document.querySelectorAll(".tab")];

const btnRender = document.getElementById("btn-render");
const btnReset = document.getElementById("btn-reset");
const btnFormat = document.getElementById("btn-format");
const btnCopyMd = document.getElementById("btn-copy-md");
const btnCopyJson = document.getElementById("btn-copy-json");

let lastMarkdown = "";
let lastJson = "";
const previewCssHref = new URL("./rasci.css", window.location.href).href;
const previewTableCssHref = new URL("./src/rasci-table.css", window.location.href).href;

function renderJSON(diagram) {
  const matrix = normalize(diagram);
  const flatMatrix = matrix.groups.flatMap(group =>
    group.tasks.map(row => ({
      group: group.label || null,
      taskId: row.task.id,
      taskLabel: row.task.label,
      meta: row.task.meta,
      assignments: Object.fromEntries(
        [...row.cells.entries()]
          .filter(([, attrs]) => attrs.length)
          .map(([alias, attrs]) => [alias, attrs])
      ),
    }))
  );

  return JSON.stringify(
    {
      roles: flatRoles(diagram.roles),
      tasks: flatTasks(diagram.tasks),
      matrix: flatMatrix,
    },
    null,
    2
  );
}

function setStatus(message, kind = "ok") {
  status.textContent = message;
  status.className = `status ${kind}`;
}

function showPane(name) {
  tabs.forEach(tab => {
    const selected = tab.dataset.pane === name;
    tab.setAttribute("aria-selected", String(selected));
  });

  document.querySelectorAll(".preview-pane").forEach(el => el.classList.remove("active"));
  document.getElementById(`pane-${name}`).classList.add("active");
}

function updateLineNumbers() {
  const lineCount = input.value.split("\n").length || 1;
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n");
}

function syncLineNumberScroll() {
  lineNumbers.scrollTop = input.scrollTop;
}

function createHtmlDocument(fragment) {
  return `<!doctype html>
<html lang="en">
<head>
  <base href="${window.location.href}">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RASCI Preview</title>
  <link rel="stylesheet" href="${previewCssHref}">
  <link rel="stylesheet" href="${previewTableCssHref}">
</head>
<body class="preview-body">
${fragment}
</body>
</html>`;
}

function formatInput(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd() + "\n";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "ok");
  } catch {
    setStatus("Clipboard access failed. Copy manually from the output pane.", "error");
  }
}

function render() {
  try {
    const source = input.value;
    const diagram = parse(source);
    const report = validate(diagram);

    const htmlFragment = renderHTML(diagram);
    const markdown = renderMarkdown(diagram, { title: "RASCI-Matrix" });
    const json = renderJSON(diagram);

    htmlFrame.srcdoc = createHtmlDocument(htmlFragment);
    markdownOutput.textContent = markdown;
    jsonOutput.textContent = json;

    lastMarkdown = markdown;
    lastJson = json;

    if (report.errors.length) {
      setStatus(`Validation errors:\n- ${report.errors.join("\n- ")}`, "error");
    } else if (report.warnings.length) {
      setStatus(`Validation warnings:\n- ${report.warnings.join("\n- ")}`, "warning");
    } else if (report.infos.length) {
      setStatus(`Validation info:\n- ${report.infos.join("\n- ")}`, "ok");
    } else {
      setStatus("Parsed and rendered successfully.", "ok");
    }
  } catch (error) {
    setStatus(error?.message || String(error), "error");
  }
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => showPane(tab.dataset.pane));
});

input.addEventListener("input", updateLineNumbers);
input.addEventListener("scroll", syncLineNumberScroll);

btnRender.addEventListener("click", () => {
  updateLineNumbers();
  syncLineNumberScroll();
  render();
});

btnReset.addEventListener("click", () => {
  input.value = STARTER;
  updateLineNumbers();
  syncLineNumberScroll();
  render();
});

btnFormat.addEventListener("click", () => {
  input.value = formatInput(input.value);
  updateLineNumbers();
  syncLineNumberScroll();
  render();
});

btnCopyMd.addEventListener("click", () => copyText(lastMarkdown));
btnCopyJson.addEventListener("click", () => copyText(lastJson));

input.value = STARTER;
updateLineNumbers();
render();
