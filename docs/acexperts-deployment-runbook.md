# AC Experts deployment and rollback runbook

**Later repository check, 12 October 2026:** GitHub exposes successful Vercel deployments named Production for this repository. A Git push may therefore deploy automatically even though this checkout has no Vercel configuration file. Review the [final verification report](acexperts-final-verification-report.md) and resolve deployment authorization before pushing; a new branch alone does not guarantee no deployment.

12 October 2026, Asia/Dubai. **No deployment is authorized or performed by this document.** Hosting provider, operating system, service manager, ingress and final staging hostname remain unknown. `https://staging.acexperts.ae` is a proposal requiring explicit approval. Historical Vercel review URLs in the Word document do not establish current hosting access or a selected deployment.

Use this with the [staging configuration checklist](staging-configuration-checklist.md), [delivery guide](delivery-configuration.md) and [database operations procedure](acexperts-database-operations.md). The production-readiness report records actual local results and external blockers. Do not treat a prepared command or configuration example as a completed hosted check.

## Verified application architecture and release inputs

- Next.js App Router on Node.js; use the project's Node.js 24 baseline and lockfile. `npm run build` invokes `next build`; `npm run start` invokes `next start`. Static-only hosting cannot run the APIs or per-request CSP proxy.
- HTML renders dynamically with a fresh nonce and private/no-store caching. Preserve those headers. Public images/fonts and Next's hashed assets have separate cache behavior; `next/image` is served by the Node runtime.
- Contact/newsletter APIs use Brevo and durable PostgreSQL. All workers in one environment share the database, namespace and HMAC key. Separate staging and production databases/secrets/namespace; cap workers according to database capacity. Pools allow up to three connections per form handler, up to six per worker for both forms.
- No application accounts or public admin/debug/health API are supplied. Protect staging at the trusted ingress, including API/static/image paths, and block direct-origin bypass. Form origin validation is not staging authentication.
- Current Git HEAD alone omits uncommitted/new implementation files. An approved release must include the reviewed source, `package.json`/lockfile, `next.config.ts` and its referenced JSON, application data/public assets and built `.next` output from the approved candidate. Preserve the raw-byte content baseline and LF checkout. Exclude environment secrets, `.git`, local PostgreSQL cache/data, test dumps and private evidence.
- Build on the target-compatible OS/architecture or CI image; do not copy Windows `node_modules` into Linux. This project currently uses normal `next start`, not a preconfigured standalone export. Do not assume an `out/` directory or `.next/standalone/server.js` exists.

The commands follow the installed Next.js [deployment guide](../node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md) and [self-hosting guide](../node_modules/next/dist/docs/01-app/02-guides/self-hosting.md). A selected hosting adapter must be tested for the same runtime, proxy, streaming, headers and image behavior.

## Build and verify the candidate locally or in isolated CI

The following are actual package commands. Run in a clean disposable copy of the reviewed candidate or isolated CI, with no live provider credentials. `npm ci` replaces `node_modules`; do not run it over the active local test workspace while its portable PostgreSQL binaries/data are under `node_modules/.cache`. These commands do not publish anything. In PowerShell, stop if any command fails:

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
foreach ($check in @('lint', 'typecheck', 'build')) {
  npm run $check
  if ($LASTEXITCODE -ne 0) { throw "Failed check: $check" }
}
```

Use a free isolated local port; check ownership before starting or stopping processes. Start the production build with deliberately invalid provider settings. Do not apply these overrides to an existing hosted environment:

```powershell
$env:CONTACT_FROM_EMAIL = 'disabled-local-validation'
$env:BREVO_NEWSLETTER_LIST_ID = 'disabled-local-validation'
npm run start -- --hostname 127.0.0.1 --port 3112
```

In another terminal, configure a fresh evidence directory and the guarded disposable PostgreSQL test database described in the database operations document. `FORM_TEST_DATABASE_URL` is a local test setting, not a production credential. It must name the approved loopback `acexperts_test` role/database, with migration already applied:

```powershell
$env:BASE_URL = 'http://127.0.0.1:3112'
$env:ARTIFACT_DIR = 'artifacts/release-candidate-local'
New-Item -ItemType Directory -Force $env:ARTIFACT_DIR | Out-Null
$env:VALIDATION_OUTPUT = Join-Path $env:ARTIFACT_DIR 'route-validation.json'
# Inject FORM_TEST_DATABASE_URL securely for the disposable local test cluster.
if (-not $env:FORM_TEST_DATABASE_URL) { throw 'Real PostgreSQL test configuration is required' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Automated tests failed' }
foreach ($check in @('check:routes', 'check:responsive', 'check:completion', 'check:motion', 'check:ac-viewer', 'check:security')) {
  npm run $check
  if ($LASTEXITCODE -ne 0) { throw "Failed check: $check" }
}
```

The `test:shared`, `test:seo`, `test:forms` and `test:security` aliases select tests already included by `npm test`. Require zero unintended skips; rendered SEO needs `BASE_URL`, real shared-store cases need the guarded test database. Run the full repaired historical suites too, under a separate output directory:

```powershell
$env:ARTIFACT_DIR = 'artifacts/release-candidate-local/historical'
New-Item -ItemType Directory -Force $env:ARTIFACT_DIR | Out-Null
$env:VALIDATION_OUTPUT = Join-Path $env:ARTIFACT_DIR 'validation-results.json'
$env:LOCAL_FORM_TEST_MODE = 'disabled-provider'
npm run validate
if ($LASTEXITCODE -ne 0) { throw 'Migration validator failed' }
node scripts/browser-check.mjs
if ($LASTEXITCODE -ne 0) { throw 'Migration browser suite failed' }
node scripts/redesign-browser-check.mjs
if ($LASTEXITCODE -ne 0) { throw 'Redesign browser suite failed' }
```

The acknowledgment `LOCAL_FORM_TEST_MODE=disabled-provider` does not disable delivery. Those browser suites POST to real local routes; the invalid server sender/list settings above are essential. Do not remove local-only test guards or point these suites at a credentialed hosted site. Use fake provider transport for outage, rate, duplicate, restart and concurrency tests.

## Hosted staging configuration gate

Before provisioning or enabling anything externally, approve the host, region, service names, hostname, network policy and candidate artifact. Configure all 13 application settings through the host's secret mechanism using [the exact contract](delivery-configuration.md#provider-and-configuration). Never store a live API key or database URL in the release, command history, screenshot or public log. Only the approved public privacy URL/version are intentionally rendered.

Apply the reviewed migration once using a dedicated owner account with stop-on-error. The schema version and required grants must be verified before enabling forms. Give the web login only documented runtime privileges; keep DDL, DELETE, backups, retention and reconciliation separate. Do not rerun the initial migration against an existing schema, invent a destructive reset, or regenerate the HMAC key/namespace during normal deployments. See [database operations](acexperts-database-operations.md) for migration, backup/restore and retention commands.

Use verified TLS for external PostgreSQL, persistent storage/WAL and an approved restore/failover strategy. Configure a per-client ingress limit based on trusted identity in addition to the application's global budgets. Every replica and release overlap must use the same shared-state configuration. Retention/reconciliation schedules, published policy and protected Brevo confirmation/withdrawal evidence are operator prerequisites.

## Conditional Linux Node and nginx recipe

This section is an **unexecuted example for a future explicitly selected Linux host**. It is not the actual known hosting configuration. Paths, service account, TLS certificate, hostname and process manager must be chosen/reviewed by the operator. Do not install a service, change firewall rules, reload nginx, switch traffic or restart production from this example without explicit authorization.

For a Linux shell in an approved immutable release directory, the same standard runtime is:

```bash
NODE_ENV=production node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3112
```

Have the chosen service manager launch that command under a dedicated unprivileged account with a fixed working directory and protected environment injection. Use bounded restart/backoff, appropriate filesystem ownership and monitored logs. Keep the application bound to loopback when nginx runs on the same host; otherwise use a private network reachable only by the trusted ingress. Never expose port 3112 publicly. Choose a graceful drain period of at least 30 seconds, send SIGTERM/SIGINT and wait; verify shutdown under fake-provider load before production. An interrupted provider call may leave a durable unresolved claim and must not automatically replay after restart.

The nginx example below assumes nginx itself terminates public TLS and sees the actual client IP. If a CDN/load balancer precedes it, its trusted address ranges, authenticated origin restriction and real-IP handling must first be configured and tested; never blindly trust incoming `X-Forwarded-For`.

```nginx
# Inside http {}; example staging-only policy, subject to traffic review.
map $uri $acexperts_form_client {
    default "";
    ~^/api/(contact|newsletter)/?$ $binary_remote_addr;
}
limit_req_zone $acexperts_form_client zone=acexperts_staging_forms:10m rate=6r/m;

server {
    listen 443 ssl;
    server_name staging.acexperts.ae;
    ssl_certificate /APPROVED/PATH/staging.fullchain.pem;
    ssl_certificate_key /APPROVED/PATH/staging.privatekey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    auth_basic "AC Experts staging";
    auth_basic_user_file /APPROVED/PRIVATE/PATH/staging-testers.htpasswd;
    add_header X-Robots-Tag "noindex, nofollow" always;

    client_max_body_size 64k;
    client_body_timeout 5s;
    limit_req_status 429;
    limit_req zone=acexperts_staging_forms burst=3 nodelay;

    location / {
        proxy_pass http://127.0.0.1:3112;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Authorization "";
        proxy_connect_timeout 3s;
        proxy_send_timeout 20s;
        proxy_read_timeout 20s;
        proxy_next_upstream off;
        proxy_cache off;
        proxy_buffering off;
    }
}
```

Replace every placeholder before an authorized `nginx -t` configuration validation. The example uses one inherited authentication/noindex boundary for all paths and disables proxy retries. Provide separate unmatched-host rejection and approved HTTP-to-HTTPS handling in the host's existing configuration; do not expose the app through an alternative virtual host. Identity-aware access or fixed-network IP restrictions can replace Basic authentication if they protect the same complete boundary. Store only password hashes in the private tester file and use strong tester-specific credentials. This template has not been loaded or validated on a selected nginx installation. [nginx authentication](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html), [proxy behavior](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [header inheritance](https://nginx.org/en/docs/http/ngx_http_headers_module.html), [request limits](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).

Preserve Next's security and Cache-Control headers. Do not add a CDN rule that caches HTML bearing per-request CSP nonces, API responses or authentication failures. Do not add unprotected static/image locations to staging. Keep production noindex changes separate: the production site retains its current index/follow pages and intentional noindex category archives. Logs should omit request bodies, Authorization, cookies, secrets and personalized query strings; inspect proxy/error/provider logs as well as application output before live testing.

## Health, readiness and post-deployment checks

The current application has no dedicated health endpoint. An authenticated `GET /` returning the expected page proves HTTP rendering availability only; it does not prove database access, current namespace/key agreement, Brevo configuration, sender validity or email delivery. Do not invent a `/health` URL or probe readiness by submitting a real enquiry/newsletter request.

Before accepting traffic, verify through the operator/database workflow: successful restricted runtime connection with verified TLS, schema version, documented privileges, namespace/key consistency, presence and syntax of required server settings, published notice/version, and host access/indexing controls. A read-only database probe and separate HTTP liveness monitor should report different statuses. Test these probes and alert routes in the chosen host; no monitoring account or deployed readiness check is configured here.

After an authorized staging deployment:

1. Without tester credentials, verify every page, API, robots, sitemap, static asset and direct-origin hostname is denied or redirected to the approved authentication flow. Do not test unauthorized account access; inspect only the newly authorized staging boundary.
2. As an authorized tester, verify HTTPS/certificate, noindex response headers, expected homepage H1, one canonical, CSP/nonces, no-store HTML/API responses, six service routes, header/footer links, fonts/images and responsive navigation. Verify both real privacy links resolve to the approved policy and show current versions.
3. Verify production canonical/sitemap destinations remain correct on staging. On production, verify the staging edge noindex/auth configuration is absent while intended source noindex archives remain intact.
4. In a separate fake-provider environment behind the intended ingress, exercise two app workers, duplicate races, shared budgets, a drained release transition, database outage and stale consent versions. Require no hidden retry, no forged-IP bypass and no secret output.
5. Only after explicit named-inbox/send-count authorization, run [controlled live acceptance](staging-configuration-checklist.md#controlled-live-delivery-plan). One enquiry/DOI at a time; stop and reconcile uncertain results. Campaign unsubscribe tests need separate authorization. Store personal evidence privately; record redacted outcomes in the release evidence.

Monitor HTTP availability/latency, status classes and 429 trends, database connection saturation/latency/errors, unresolved claim age/count, overdue retention rows, backup freshness/restore results, certificate/key expiry and Brevo delivery/suppression failures. Avoid high-cardinality personal labels. Confirm alerts reach authorized operators without making this document an authorization to contact third parties.

## Release, rollback and incident recovery

Before release, record the candidate manifest/build ID, previous known-good artifact, schema version, runtime configuration identifiers, shared namespace/key ownership, backup/restore checkpoint, rollback owner and acceptance gates. Retain old immutable static assets during a controlled release overlap to avoid missing chunks; test navigation between deployed versions. Do not rebuild unrelated artifacts independently on every replica.

On an authorized rollout, bring up the candidate privately, complete readiness checks, switch only the approved route/traffic target, drain old workers, then perform the authorized smoke checks. Concrete service-manager and traffic-switch commands remain **BLOCKED until the host and service names are selected**. No generic `systemctl`, DNS or hosting CLI command is claimed to match an existing production service.

For rollback, stop new traffic to the failing candidate and restore routing to the previously verified compatible artifact through the chosen platform's approved procedure. Preserve the existing PostgreSQL database, schema, namespace and HMAC key. Do not run reverse DDL, clear claims, downgrade to the old in-memory implementation or restore an older database merely to roll back application code. Recheck HTML/assets, security, database compatibility and form failure behavior before reopening traffic. Record unresolved sends for operator reconciliation.

Database disaster recovery is a separate approved operation. Follow the [database operations procedure](acexperts-database-operations.md), restore to a new isolated database first, verify schema/data/privileges and reconcile Brevo actions newer than the recovery point before any cutover. An older backup can lose accepted/pending claims and cause duplicate delivery if traffic resumes blindly. Keep delivery disabled until that reconciliation completes. Hosted backup schedules, PITR, approved RPO/RTO and recovery drills remain external configuration; local synthetic restore evidence does not establish them.

Production release remains blocked until critical code checks, infrastructure/security configuration, approved privacy/retention operations, controlled live delivery/confirmation/unsubscribe acceptance and operational recovery are verified. Commit, push, deployment, DNS/firewall changes and production restarts require explicit authorization. This runbook performs none of those actions.
