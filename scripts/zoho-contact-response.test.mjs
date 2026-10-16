import assert from "node:assert/strict";
import { test } from "node:test";
import { parseZohoContactResponse } from "../lib/zoho-contact-response.ts";

const origin = "https://acexperts.ae";
const parse = (data, siteOrigin = origin) => parseZohoContactResponse(data, siteOrigin);

test("accepts the exported splash message without requiring an absent success flag", () => {
  assert.deepEqual(parse({ actionsubmit: "Splash Message", actionvalue: "  Thank you for your enquiry.  " }), {
    kind: "success", message: "Thank you for your enquiry.",
  });
  assert.deepEqual(parse({ actionsubmit: "Splash Message", actionvalue: " " }), { kind: "unconfirmed" });
  assert.deepEqual(parse({ actionsubmit: "Splash Message", actionvalue: { text: "Thanks" } }), { kind: "unconfirmed" });
  assert.equal(parse({ actionsubmit: "Splash Message", actionvalue: "x".repeat(3000) }).message.length, 2000);
});

test("preserves success messages as text instead of extracting or executing markup", () => {
  const message = '<img src=x onerror="alert(1)">Thank you';
  assert.deepEqual(parse({ actionsubmit: "Splash Message", actionvalue: message }), { kind: "success", message });
});

test("confirmed redirects and the exported thank-you action support approved HTTPS origins", () => {
  for (const actionsubmit of ["redirect_url", "parent_redirect"]) {
    for (const success of [true, "true"]) {
      assert.deepEqual(parse({ actionsubmit, success, redirectUrl: "https://acexperts.ae/thank-you/?from=crm" }), {
        kind: "redirect", url: "https://acexperts.ae/thank-you/?from=crm",
      });
    }
  }
  for (const allowedOrigin of [origin, "https://www.acexperts.ae", "https://crm.zoho.com", "https://crm.zohopublic.com"]) {
    assert.deepEqual(parse({ actionsubmit: "thankyou_page", redirectUrl: `${allowedOrigin}/thanks` }), {
      kind: "redirect", url: `${allowedOrigin}/thanks`,
    });
  }
  assert.deepEqual(parse({ actionsubmit: "thankyou_page", redirectUrl: "https://preview.example.test/thanks" }, "https://preview.example.test"), {
    kind: "redirect", url: "https://preview.example.test/thanks",
  });
});

test("explicit provider failures override every success-looking response and hide provider error markup", () => {
  for (const actionsubmit of ["Splash Message", "redirect_url", "parent_redirect", "thankyou_page"]) {
    for (const success of [false, "false"]) {
      const result = parse({ actionsubmit, success, actionvalue: "Success", redirectUrl: `${origin}/thanks` });
      assert.equal(result.kind, "error");
      assert.match(result.message, /did not accept/);
    }
    for (const invalidCaptcha of [true, "true"]) {
      const result = parse({ actionsubmit, success: true, invalidCaptcha, actionvalue: "Success", redirectUrl: `${origin}/thanks` });
      assert.equal(result.kind, "error");
      assert.match(result.message, /could not verify/);
    }
  }
  for (const actionsubmit of ["error_msg", "captcha_error"]) {
    const result = parse({ actionsubmit, success: true, message: "<script>secret provider details</script>" });
    assert.equal(result.kind, "error");
    assert.doesNotMatch(result.message, /script|secret|provider details/);
  }
});

test("redirect actions require explicit confirmation except for thankyou_page", () => {
  for (const actionsubmit of ["redirect_url", "parent_redirect"]) {
    for (const success of [undefined, null, 1, "yes"]) {
      assert.deepEqual(parse({ actionsubmit, success, redirectUrl: `${origin}/thanks` }), { kind: "unconfirmed" });
    }
  }
});

test("rejects untrusted, malformed, credential-bearing and non-HTTPS redirects", () => {
  const unsafeTargets = [
    "https://attacker.example/thanks",
    "https://crm.zoho.com.attacker.example/thanks",
    "https://attacker.example/?next=https://crm.zoho.com",
    "https://crm.zoho.com@attacker.example/thanks",
    "https://user:password@crm.zoho.com/thanks",
    "https://crm.zoho.com:8443/thanks",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://acexperts.ae/thanks",
    "//crm.zoho.com/thanks",
    "/thanks",
    "https://crm.zoho.com/\nthanks",
    "not a url",
    "",
    null,
    {},
  ];
  for (const redirectUrl of unsafeTargets) {
    assert.deepEqual(parse({ actionsubmit: "thankyou_page", redirectUrl }), { kind: "unconfirmed" }, String(redirectUrl));
  }
  assert.deepEqual(parse({ actionsubmit: "thankyou_page", redirectUrl: "http://localhost:3112/thanks" }, "http://localhost:3112"), {
    kind: "unconfirmed",
  });
  assert.deepEqual(parse({ actionsubmit: "thankyou_page", redirectUrl: "https://crm.zoho.com/thanks" }, "not a url"), {
    kind: "redirect", url: "https://crm.zoho.com/thanks",
  });
});

test("unknown, HTML and hash-only responses never fabricate confirmation", () => {
  for (const data of [
    undefined, null, true, 200, "Thank you", "<html>Success</html>", [],
    { success: true },
    { actionsubmit: "unknown", success: true },
    { actionsubmit: "add_hash", hash: "thanks", success: true },
  ]) {
    assert.deepEqual(parse(data), { kind: "unconfirmed" });
  }
});
