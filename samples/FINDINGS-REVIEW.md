# Sample Report — Manual Findings Review

**Target:** `vlayer-demo-nextjs/src` (the official intentionally-insecure demo app)
**Scanner:** `vlayer report` @ branch `fix/scanner-precision-pass` (precision pass on top of white-label PR #40)
**AI triage:** disabled (`ANTHROPIC_API_KEY` unset) so findings are deterministic and reviewable
**Branding:** default VLayer (no `--brand-name` / `--brand-logo`)

> Success criterion for this pass: a sample with **0 duplicates** and **0 findings
> that are indefensible to a skeptical CTO.**

---

## TL;DR / Verdict

✅ **Publishable.** The precision pass closed every blocker from the PR #40 review.

| Metric | PR #40 sample | This pass |
|---|---|---|
| Total findings | 33 | **26** |
| Exact duplicates | 4 | **0** |
| Self-referential FPs (own report re-scanned) | 62 (root scan) | **0** (excluded by default) |
| "Network Segmentation" on `localStorage` | 1 | **0** |
| "Network Segmentation" on client `fetch()` | 2 | **0** |
| MFA-001 / BACKUP-001 anchored to an `import` line | 2 | **0** (anchored to real usage) |
| Indefensible / factually-wrong findings | several | **0** |

Every one of the 26 findings is a factually-correct true positive against the
demo's intentional `// VIOLATION:` markers. One **non-blocking** redundancy note
is documented below (overlapping PHI-in-log rules); it is not a wrong finding.

---

## What changed in the scanner (and why it's now defensible)

1. **Own outputs excluded by default.** `vlayer-report.*`, `vlayer-audit-report.*`,
   `.vlayer-baseline.json`, `.vlayer/`, and `samples/` are excluded in file
   discovery (opt out with `--include-own-artifacts`). This kills the 62/65%
   self-referential false positives that scanning the demo root used to produce.
2. **Exact-duplicate dedupe before grouping.** `errorsScanner` runs under two
   categories (phi-exposure + audit-logging), so it emitted each `ERROR-00x`
   finding twice. A dedupe pass keyed by `ruleId + file + line + snippet` now runs
   before grouping, so all 4 duplicates are gone across every output format.
3. **MFA-001 / BACKUP-001 no longer anchor to imports.** Both used to point at
   `import { createClient } from '@supabase/...'` (line 2). They now anchor to the
   real usage line (`createClient(SUPABASE_URL, …)`, line 10). MFA-001 does not
   fire when the only evidence is an import. BACKUP-001 prefers the usage line but
   **falls back to the import for import-only DB libraries (drizzle, knex)** to
   avoid losing detection — see "Judgment calls" below.
4. **HIPAA-SEGMENT-001 scoped to its real intent.** Network segmentation is a
   server/infra control. The rule no longer fires on client-side `localStorage`
   (the `storage` token was matching `localStorage`) or on client `fetch()/axios`
   calls that merely *consume* a PHI API. It still fires on server routes that
   *expose* PHI (e.g. `app.get('/api/patients')` with a CORS wildcard).

Each rule change ships with a regression test (`tests/precision/`): the
mis-firing case no longer fires, and a legitimate case still does.

---

## Finding-by-finding review (26 findings, all verified true)

### ✅ Verified true positives

| Severity | Location | Rule | Verified against source |
|---|---|---|---|
| critical | page.tsx:25 | `phi-phi-localstorage` / `HIPAA-ENC-REST-001` / `retention-phi-cache` | `localStorage.setItem("patientCache", …)` — PHI cached unencrypted |
| critical | page.tsx:27,31 / route.ts:36 | `ERROR-002` PHI in error logs | `console.log/error` of `patient.*` / `err.patientName` |
| critical | route.ts:10 | `MFA-001` auth config without MFA | `createClient(SUPABASE_URL, …)` — anchored to usage ✅ |
| critical | route.ts:12 | `HIPAA-MFA-001` no MFA on PHI endpoint | unauthenticated `GET` |
| high | page.tsx:20 | `enc-missing` unencrypted HTTP | `fetch("http://…/api/patients")` |
| high | page.tsx:31 / route.ts:36,37 | `phi-patient-name-log`, `phi-phi-console-log`, `phi-phi-template-log` | PHI in console output (see redundancy note) |
| high | route.ts:21,62 | `RBAC-001` PHI access without role check | no auth/role guard |
| high | route.ts:67 | `ERROR-001` unsanitized error to user | returns `error.message` |
| high | page.tsx:35 | `HIPAA-SESSION-001` no session timeout | dashboard with no idle timeout |
| high | project-level | `HIPAA-PENTEST-001` no vuln-scan config | advisory, project-level |
| medium | route.ts:10 | `BACKUP-001` DB without backup | `createClient(SUPABASE_URL, …)` — anchored to usage ✅ |
| medium | route.ts:22 | `RBAC-003` `SELECT *` on PHI | `.select("*")` |
| medium | route.ts:51 | `phi-address` address handling | returns `patient.address` |
| medium | route.ts:63 | `retention-unlogged-delete` | `.delete()` with no audit log |
| info | — | `HIPAA-ASSET-001` / `HIPAA-FLOW-001` | generated inventory + flow map |

### ⚠️ Non-blocking note: overlapping PHI-in-log rules

`route.ts:36` and `:37` (and `page.tsx:31`) are each flagged by up to three
distinct rules — `phi-patient-name-log`, `phi-phi-console-log`,
`phi-phi-template-log` — for the same `console.log(...)` of PHI. Every one is
**factually correct** (it is a patient name, it is PHI in console output, it is in
a template literal), so none is indefensible. But three "high" rows for one line
reads as redundant.

This is **cross-rule overlap**, which is deliberately out of scope for this pass:
Part 2's dedupe targets *exact* duplicates (same ruleId+file+line). Collapsing
*different* rules that describe the same line needs a rule-taxonomy/consolidation
decision and risks dropping distinct detections. **Listed, not given as "good"** —
recommend a follow-up to consolidate the PHI-in-log rule family.

---

## Judgment calls (flagged for review, per "document, don't decide alone")

- **BACKUP-001 import fallback.** Strictly never firing on an `import` line would
  silently lose detection for DB libraries whose only signature *is* the import
  (drizzle, knex; and supabase/typeorm when the client-init line doesn't repeat
  the library name). So BACKUP-001 prefers a real-usage anchor and only falls back
  to the import when no usage line exists. The demo (which has real usage) anchors
  to usage. If you'd rather BACKUP-001 never point at an import even at the cost of
  drizzle/knex coverage, that's a one-line change — flagging for your call.
- **SEGMENT-001 client-call exclusion.** I extended the mandated localStorage fix
  to also exclude client `fetch()/axios` consumers, on the rationale that network
  segmentation is about *exposing* a PHI service, not *calling* one. The existing
  server-route test still passes. If you consider a client fetch of a PHI endpoint
  in-scope for SEGMENT-001, revert the two `negativePatterns` lines.

---

## How the sample was generated

```bash
# AI triage off → deterministic findings. Scoped to ./src (app source).
# (vlayer now also excludes its own outputs by default, so scanning the demo
#  root no longer self-flags vlayer-report.json.)
env -u ANTHROPIC_API_KEY -u VLAYER_AI_KEY \
  vlayer report ~/Projects/vlayer-demo-nextjs/src --format html --output samples/sample-report.html
env -u ANTHROPIC_API_KEY -u VLAYER_AI_KEY \
  vlayer report ~/Projects/vlayer-demo-nextjs/src --format pdf  --output samples/sample-report.pdf
```

Artifacts: `samples/sample-report.html`, `samples/sample-report.pdf` (default VLayer branding).
