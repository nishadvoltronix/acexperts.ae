import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { load } from "cheerio";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
// Exercise the real TS/TSX renderer without a test runner or another dependency.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const local = specifier.startsWith("@/")
      ? resolve(root, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? resolve(dirname(fileURLToPath(context.parentURL)), specifier) : null;
    if (local && !extname(local)) {
      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(local + extension))
          return { url: pathToFileURL(local + extension).href, shortCircuit: true };
      }
    }
    if (specifier.startsWith("@/")) return nextResolve(local, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url) && !url.includes("/node_modules/")) {
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText;
      return { format: "commonjs", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { ImageConfigContext } = require("next/dist/shared/lib/image-config-context.shared-runtime");
const { imageConfigDefault } = require("next/dist/shared/lib/image-config");
const { RichContent } = require("../components/RichContent.tsx");
const { localLink } = require("../lib/content.ts");
const { safeContentUrl, isAllowedContentTag } = require("../lib/content-safety.ts");
const render = (html, props = {}) => renderToStaticMarkup(createElement(ImageConfigContext.Provider,
  { value: { ...imageConfigDefault, qualities: [75, 90] } }, createElement(RichContent, { html, ...props })));

test("links reject executable, malformed and ambiguous URLs, including obfuscation", () => {
  for (const href of [
    "javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\nscript:alert(1)",
    "java\tscript:alert(1)", "\u0000javascript:alert(1)", "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)", "file:///etc/passwd", "blob:https://acexperts.ae/123",
    "//attacker.example/path", "\\\\attacker.example/path", "/\\attacker.example/path",
    "https://user:password@example.com/", "https://[invalid", "", null, {},
  ]) {
    assert.equal(safeContentUrl(href), undefined);
    assert.equal(localLink(href), "#");
  }
  for (const href of ["#faq", "/contact-us/", "contact-us/", "https://acexperts.ae/contact-us/",
    "https://example.com/", "http://example.com/", "mailto:info@example.com", "tel:+971123456789"])
    assert.equal(safeContentUrl(href), href);
  assert.equal(localLink("https://acexperts.ae/contact-us/?ref=home#map"), "/contact-us/?ref=home#map");
  assert.equal(localLink("https://acexperts.ae//attacker.example/"), "#");
});

test("rendering removes executable elements, namespaces and forbidden attributes", () => {
  const html = render('<p id="intro" class="copy" style="background:url(https://attacker.example)" onclick="alert(1)" srcdoc="evil">Safe <strong>text</strong></p>' +
    '<script>alert(1)</script><style>body{display:none}</style><iframe srcdoc="evil"></iframe>' +
    '<object data="data:text/html,evil">object payload</object><embed src="https://attacker.example">' +
    '<base href="https://attacker.example"><meta http-equiv="refresh" content="0;url=https://attacker.example">' +
    '<svg><a href="javascript:alert(1)">svg payload</a></svg><math><mtext>math payload</mtext></math>' +
    '<form action="https://attacker.example"><input name="secret">form payload</form>');
  assert.equal(html, '<p id="intro" class="copy">Safe <strong>text</strong></p>');
});

test("HTML-entity and control-character URL payloads cannot become executable links", () => {
  const html = render('<a href="&#x6a;avascript:alert(1)">one</a>' +
    '<a href="java&#x09;script:alert(1)">two</a><a href=" javascript:alert(1)">three</a>' +
    '<a href="data:text/html,evil">four</a><a href="//attacker.example/">five</a>');
  assert.equal(html, "<span>one</span><span>two</span><span>three</span><span>four</span><span>five</span>");
});

test("heading replacements and wrapper normalization use sanitized attributes too", () => {
  const html = render('<div class="content-grid columns-2" style="color:red" onclick="evil()">' +
    '<h1>Removed</h1><h4 title="Preserved" style="color:red" onmouseover="evil()">Heading</h4></div>',
  { omitH1: true, headingOverrides: { Heading: "h2" } });
  assert.equal(html, '<div class="content-grid"><h2 title="Preserved">Heading</h2></div>');
});

test("semantic content, accessibility, table attributes and external link protections survive", () => {
  const html = render('<details open><summary aria-label="Question">Question</summary><p>Answer</p></details>' +
    '<table><tbody><tr><th scope="col" colspan="2">Title</th><td rowspan="2">Value</td></tr></tbody></table>' +
    '<time datetime="2026-10-07">Date</time><br><hr>' +
    '<a href="https://example.com/" target="_blank" rel="opener">Visit</a>');
  const dom = load(html);
  assert.equal(dom("details").is("[open]"), true);
  assert.equal(dom("summary").attr("aria-label"), "Question");
  assert.equal(dom("th").attr("scope"), "col");
  assert.equal(dom("th").attr("colspan"), "2");
  assert.equal(dom("td").attr("rowspan"), "2");
  assert.equal(dom("time").attr("datetime"), "2026-10-07");
  assert.equal(dom("a").attr("rel"), "noopener noreferrer");
  assert.equal(dom("a").attr("target"), "_blank");
});

test("all checked-in migrated content uses allowed tags and safe URLs, and preserves visible text", () => {
  const pages = JSON.parse(readFileSync(resolve(root, "data/pages.json"), "utf8"));
  let checked = 0;
  for (const page of pages) {
    const snippets = [page.contentHtml, page.sidebarHtml, page.article?.authorBio,
      ...(page.sections || []).map((section) => section.html),
      ...(page.slides || []).map((slide) => slide.html), ...(page.faqs || []).map((faq) => faq.answerHtml)];
    for (const source of snippets.filter(Boolean)) {
      const dom = load(source, null, false);
      dom("*").each((_, node) => {
        assert.ok(isAllowedContentTag(node.name), `${page.route}: unsupported tag ${node.name}`);
        if (node.attribs.href) assert.ok(safeContentUrl(node.attribs.href), `${page.route}: unsafe link`);
      });
      // Project filters intentionally replace their source controls with a React component.
      if (!dom(".project-filters").length) {
        const output = load(render(source), null, false);
        // HTML parsing legitimately removes whitespace text nodes between table cells.
        assert.ok(output.text().replace(/\s+/g, "") === dom.text().replace(/\s+/g, ""),
          `${page.route}: visible text changed`);
      }
      checked++;
    }
  }
  assert.ok(checked > 100);
});
