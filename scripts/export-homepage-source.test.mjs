import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { createSourceReview, localHomepageUrl } from "./export-homepage-source.mjs";

test("export retains original bytes, inline spacing, attributes, comments and raw-text blocks", () => {
  const source = '<!DOCTYPE html><html lang="en"><head><title>A &amp; B</title><style>p::before{content:"< >"}</style>' +
    '<script nonce="example">if(a<2){window.html="<div>literal</div>"}</script></head><body><div class="home-page">' +
    '<section id="one"><h1>AC <em>Experts</em>!</h1><p data-note="x > y &amp; z">Left<span>Right</span> tail</p>' +
    '<pre>  keep\n    spacing <b>here</b></pre><textarea>\n keep &lt; &amp; &gt; </textarea>' +
    '<!-- preserve this --><noscript><iframe src="https://example.invalid/"></iframe></noscript></section>' +
    '<section id="two"><h2>Second</h2><img alt="a &quot;quote&quot;" src="image.png" /></section></div></body></html>';
  const { html, summary } = createSourceReview(source, "http://127.0.0.1:3100/");
  const $ = load(html);
  assert.equal($(".original-source").map((_, node) => $(node).text()).get().join(""), source);
  assert.deepEqual(summary.sections.map((section) => section.id), ["one", "two"]);
  assert.equal($("#section-1 .section-label").text(), "Section 1: AC Experts!");
  assert.equal($("#section-2 .section-label").text(), "Section 2: Second");
  assert.equal(summary.serverResponseFormatted, false);
  assert($(".original-source").toArray().some((node) => $(node).text().includes('<pre>  keep\n    spacing <b>here</b></pre>')));
});

test("opening the export cannot activate archived scripts, resources or event handlers", () => {
  const source = '<html><head><script src="https://example.invalid/tracker.js"></script></head>' +
    '<body><div class="home-page"><section><h1>&lt;/code&gt;</h1><img src="https://example.invalid/pixel" onerror="alert(1)">' +
    '<iframe src="https://example.invalid/frame"></iframe><script>alert("</code>")</script></section></div></body></html>';
  const { html } = createSourceReview(source, 'http://localhost:3100/?"><script>alert(1)</script>');
  const $ = load(html);
  assert.equal($("script,iframe,img,[onerror],link").length, 0);
  assert.match($('meta[http-equiv="Content-Security-Policy"]').attr("content"), /default-src 'none'/);
  assert.equal($(".original-source").map((_, node) => $(node).text()).get().join(""), source);
});

test("export accepts only a local homepage URL and rejects remote or ambiguous targets", () => {
  for (const input of ["http://localhost:3100/", "http://127.0.0.1:3100/", "http://[::1]:3100/"]) {
    assert.equal(localHomepageUrl(input).href, input);
  }
  for (const input of ["https://acexperts.ae/", "file:///index.html", "http://localhost:3100/about/", "http://user:pass@localhost/", "http://localhost/?token=secret", "http://localhost/#section", "http://localhost.example.invalid/"]) {
    assert.throws(() => localHomepageUrl(input));
  }
});
