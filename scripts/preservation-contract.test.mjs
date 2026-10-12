import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";

const json = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const baseline = await json("docs/redesign-baseline.json");
const pages = await json("data/pages.json");
const changes = await json("docs/completion-preservation-changes.json");
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("original routes, canonicals, indexability and every original FAQ answer survive", () => {
  for (const original of baseline.pages) {
    const current = pages.find((page) => page.route === original.route);
    assert.ok(current, original.route);
    assert.equal(current.canonical, original.canonical, original.route);
    assert.equal(current.robots, original.robots, original.route);
    assert.equal(digest(JSON.stringify(current.faqs)), original.faqsSha256, `FAQ answers: ${original.route}`);
  }
  assert.deepEqual(pages.filter((page) => !baseline.pages.some((old) => old.route === page.route)).map((page) => page.route).sort(),
    ["/ac-duct-cleaning-services-in-dubai/", "/hvac-services/"]);
});

test("all articles and content outside explicitly revised service/project/contact/logo sections are preserved", () => {
  const revised = new Set(["/services/", "/projects/", "/contact-us/", "/faq/"]);
  for (const original of baseline.pages) {
    if (revised.has(original.route)) continue;
    const current = pages.find((page) => page.route === original.route);
    assert.equal(digest(current.contentHtml || ""), original.contentSha256, `Content: ${original.route}`);
    assert.equal(digest(JSON.stringify(current.sections)), original.sectionsSha256, `Sections: ${original.route}`);
  }
});

test("only the two reviewed protected files depart from the original snapshot; original media remains byte-identical", async () => {
  assert.deepEqual(changes.files.map((file) => file.path).sort(), ["app/api/contact/route.ts", "data/pages.json"]);
  for (const file of baseline.files) {
    const intentional = changes.files.find((item) => item.path === file.path);
    if (intentional) {
      assert.equal(intentional.originalSha256, file.sha256);
      assert.ok(intentional.reason.length > 40);
    }
    const actual = digest(await readFile(new URL(`../${file.path}`, import.meta.url)));
    assert.equal(actual, intentional?.sha256 || file.sha256, file.path);
  }
});
