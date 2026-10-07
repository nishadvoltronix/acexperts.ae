import { readFile, writeFile } from "node:fs/promises";

const paths = process.argv.slice(2);
if (paths.length < 2) throw new Error("Supply the full browser report followed by one or more focused recheck reports.");
const reports = await Promise.all(paths.map(async (path) => ({ path, data: JSON.parse(await readFile(path, "utf8")) })));
const pages = JSON.parse(await readFile("data/pages.json", "utf8"));
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const caseKey = (row) => `${row.path} @ ${row.width}`;
function latestRows(property) {
  const rows = new Map();
  for (const report of reports) for (const row of report.data[property]) rows.set(caseKey(row), { ...row, evidence: report.path, checkedAt: report.data.checkedAt });
  return [...rows.values()];
}
const cases = latestRows("cases");
const accessibility = latestRows("accessibility");
const consistency = latestRows("consistency");
const failures = [];
const supersededFailures = [];
for (let index = 0; index < reports.length; index++) {
  const report = reports[index];
  for (const failure of report.data.failures) {
    const replacement = reports.slice(index + 1).find((later) => later.data.cases.some((row) => caseKey(row) === failure.path) || (failure.kind.startsWith("interaction") && later.data.interactionConsole));
    if (replacement) supersededFailures.push({ ...failure, evidence: report.path, supersededBy: replacement.path });
    else failures.push({ ...failure, evidence: report.path });
  }
}
const missingCases = pages.flatMap((page) => widths.filter((width) => !cases.some((row) => row.path === page.route && row.width === width)).map((width) => ({ path: page.route, width })));
for (const missing of missingCases) failures.push({ kind: "missing-case", ...missing });
const latest = reports.at(-1).data;
const result = {
  summarizedAt: new Date().toISOString(),
  method: "Latest recorded result per route and viewport. The full audit remains unchanged; focused final-build rechecks supersede only the routes and widths actually rerun. Original failures remain listed below and in their source reports.",
  sources: reports.map(({ path, data }) => ({ path, checkedAt: data.checkedAt, baseUrl: data.baseUrl, summary: data.summary })),
  widths,
  cases,
  accessibility,
  consistency,
  interactions: latest.interactions,
  interactionConsole: latest.interactionConsole,
  supersededFailures,
  failures,
  summary: {
    routes: new Set(cases.map((row) => row.path)).size,
    viewportCases: cases.length,
    expectedViewportCases: pages.length * widths.length,
    accessibilityScans: accessibility.length,
    designConsistencyChecks: consistency.length,
    interactionChecks: latest.interactions.length,
    originalFailuresRechecked: supersededFailures.length,
    failures: failures.length,
    passed: failures.length === 0 && missingCases.length === 0 && cases.every((row) => row.ok) && consistency.every((row) => row.ok) && accessibility.every((row) => row.violations.length === 0) && latest.interactions.every((row) => row.ok),
  },
};
await writeFile("docs/redesign-browser-final.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary, null, 2));
if (!result.summary.passed) process.exitCode = 1;
