# AC Experts security review

12 October 2026, Asia/Dubai. This review covers the current uncommitted application and development dependency tree. No package, account, DNS, production service or deployment changes were made by this review. Public staging protections and live Brevo lifecycle verification remain external prerequisites.

## Dependency findings and remediation decision

**PARTIAL: the full audit still reports five high development findings. No supported compatible patched release was available at review time.** The five findings are one underlying `braces` stack-exhaustion advisory propagated through its dependents, rather than five independent production vulnerabilities.

| Package | Installed | Classification and reachability |
| --- | --- | --- |
| `braces` | 3.0.3 | Underlying advisory; deeply nested attacker-selected patterns can exhaust the stack. Development dependency only. |
| `micromatch` | 4.0.8 | Depends on affected `braces`; inherited finding. Development only. |
| `fast-glob` | 3.3.1 | Depends on `micromatch`; inherited finding. Development only. |
| `@next/eslint-plugin-next` | 16.3.8 | Imports `fast-glob` in the configured Next root-directory glob utility. Development only. |
| `eslint-config-next` | 16.3.8 | Direct development dependency that includes the plugin; inherited finding. |

The [official advisory GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists versions through 3.0.3 and no patched release. The [upstream discussion](https://github.com/micromatch/braces/issues/70) disputes arbitrary untrusted-pattern use and suggests restricting input; it does not provide a released fix. The installed recursive compile path matches [upstream 3.0.3 source](https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js).

Fresh npm registry metadata confirms `braces` latest is 3.0.3, `micromatch` latest 4.0.8 retains it, `fast-glob` latest 3.3.3 retains `micromatch`, and the newer Next ESLint plugin 16.4.0 still pins `fast-glob` 3.3.1. A patch/minor bump along that chain would not remove this finding. npm proposes downgrading `eslint-config-next` to 14.2.35; that is inappropriate for this Next 16 application and its flat configuration. No forced downgrade, package alias, vendored patch, audit suppression or claim of remediation was introduced. `package.json` and `package-lock.json` were preserved by this review.

Evidence is in [dependency-security-analysis.json](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/dependency-security-analysis.json), with raw audit, dependency-tree and registry-query files named there. The [full audit](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/dependency-audit-full.json) exits 1 with five high findings; the [production-only audit](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/dependency-audit-production.json) exits 0 with zero known findings. The targeted `npm ls --omit=dev` tree is empty; its exit 1 means none of the requested development packages are in that tree, not that the production audit failed. npm audit scope and exit behavior are documented in [npm's audit reference](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

A bounded, isolated child-process probe reproduced `RangeError` with a 9,001-character nested input; smaller 201- and 7,001-character inputs returned. The test catches the exception, caps memory and execution time, and does not target a web service. This confirms the library behavior on this Node runtime; it does not establish a reachable application exploit.

The only installed Next plugin `fast-glob` call reads `settings.next.rootDir`, consistent with [Next's source](https://github.com/vercel/next.js/blob/v16.3.8/packages/eslint-plugin-next/src/utils/get-root-dirs.ts). The effective project ESLint configuration does not define that setting. Instrumenting the actual helper with the effective configuration observed **zero glob calls**. [Reachability evidence](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/dependency-reachability.json). Application routes do not import these tools or turn HTTP data into glob patterns. Accordingly, this review found no public-request path to this advisory; development/CI denial of service remains possible if future tooling accepts malicious patterns or untrusted configuration.

Required actions: keep lint/build runners isolated from production credentials, review configuration/dependency changes before execution, keep externally supplied data out of glob settings, and monitor for an upstream supported fix. Run the full audit again at release approval; an owner must explicitly acknowledge the unresolved development finding if release policy allows it. An audit exception is not a patched dependency. Do not use `npm audit fix --force` to disguise the issue.

## Application and deployment boundaries

**COMPLETE for this source review; hosted behavior remains NOT VERIFIED.** No new critical application-code defect was found in the reviewed surfaces. This is a bounded source/test review, not a guarantee of vulnerability absence.

| Surface | Evidence and current protection | Required external verification |
| --- | --- | --- |
| Authentication, authorization, administration | Only public page routes plus contact/newsletter POST handlers. No login, session cookie, admin, upload or debug endpoint is implemented. Public forms intentionally accept unauthenticated visitors. | Protect all staging paths with edge tester authentication/IP policy; prevent direct-origin bypass. Origin checking does not authenticate a caller. |
| Input and request bounds | Server field allowlists, required values, length/control-character checks, service enum, honeypot, versioned boolean newsletter consent; JSON-only uncompressed bodies; 48 KiB contact/4 KiB newsletter bounds and five-second body deadline. | Apply ingress connection/body limits; verify proxy behavior on malformed/slow requests. |
| CSRF/CORS | Exact production origins or explicitly configured HTTPS staging origins, bounded loopback exceptions, rejection of cross-site fetch metadata, no permissive CORS headers, POST/JSON requirements. | Verify actual host/proxy origins and preflight behavior; do not treat forgeable headers as bot authentication. |
| Abuse and duplicate submissions | PostgreSQL atomic shared budgets, HMAC payload keys and durable claims; failures stop delivery; pending/uncertain/timeout claims have no automatic takeover. Secondary local bound is not a production substitute. | Shared configuration on all instances, ingress per-client limits, reconciliation ownership and intended-topology checks. |
| SQL injection and privileges | Parameterized query values throughout `lib/form-store.ts`; static SQL; migrations separate from HTTP handling; schema-version/key-fingerprint checks; TLS certificate verification for remote DB endpoints; bounded pool/query/transaction timeouts. | Restricted runtime role, separate staging database, private network, backup/restore, permission audits and host log redaction. Database privileges are not provisioned by source review. |
| XSS/content | Migrated content uses explicit tag/attribute/URL allowlists. Event/style/srcdoc/executable elements are dropped. Images resolve only from the local asset inventory. Structured JSON-LD escapes `<`; contact email HTML is escaped. External blank-target links use `noopener noreferrer`. | Retain rendering protections when content sources change; verify final CSP under the real host. |
| CSP/security headers | Fresh cryptographic nonce, replacement of client-supplied nonce/CSP headers, strict script policy, no production unsafe-eval, no framing/object content; nonce-bearing HTML is private/no-store. API JSON is no-store/nosniff; frame, referrer, permissions and production HSTS headers are configured. | Verify edge/CDN does not cache nonce-bearing HTML, overwrite CSP, or introduce unsafe script dependencies. Inline style attributes are intentionally permitted for React/image layout; raw migrated styles are not passed through. |
| Secrets and errors | Server-only configuration, `.env*` ignored with placeholder-only sample exception; generic public errors; no application console logging of requests/driver/provider details. PostgreSQL driver errors are contained. Only approved public privacy URL/version enter form props. | Verify secret manager, host/proxy/provider logs, access/rotation ownership, build artifacts and backup protection. Local tests cannot prove deployed logging policy. |
| Outbound requests and redirects | Brevo API endpoint is fixed; provider redirects are rejected, dispatch has an eight-second deadline and no automatic retry. Sender/recipient/list/template/redirect are server configuration. Site redirects come from checked-in maps, not request parameters. | Verify configured HTTPS DOI destination and sender/account ownership. Provider acceptance is not inbox arrival. |
| Newsletter/privacy | Exact checkbox wording/version and notice version, keyed email identity and audit row committed before dispatch; provider acceptance never sets confirmation. DOI payload does not clear blocklists or directly enroll contacts. | Publish approved privacy notice and retention process; verify real DOI arrival/confirmation, existing/unsubscribed contacts, campaign withdrawal and suppression with separately authorized test addresses. No unsubscribe webhook or campaign endpoint exists here. |

Fresh source checks for request security, sanitized rendering, form delivery and staging safety are recorded in [security-source-tests.txt](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/security-source-tests.txt). The overall readiness report records the final build, complete test run, real PostgreSQL and browser results; those should not be inferred from this source review alone.

## Remaining security conditions for release

1. Provision and externally test staging authentication, direct-origin protection, HTTPS/noindex isolation, trusted ingress limits and safe operational logs.
2. Verify hosted PostgreSQL TLS, restricted privileges, recovery, retention, reconciliation and consistent namespace/key state through deployment overlap.
3. Approve privacy content and process; complete authorized live Brevo confirmation and unsubscribe/suppression tests without using real customer audiences.
4. Review the still-open development dependency advisory under the release policy and recheck supported upstream fixes. Do not report the full audit as clean.
5. Review the exact immutable release and obtain explicit authorization before commit, push, deployment, DNS changes or production restarts.
