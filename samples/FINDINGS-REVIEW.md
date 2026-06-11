# Sample Report — Manual Findings Review

**Target:** `vlayer-demo-nextjs` (the official intentionally-insecure demo app)
**Scanner:** `vlayer report` @ branch `feat/white-label-reports`
**AI triage:** disabled (`ANTHROPIC_API_KEY` unset) so findings are deterministic and reviewable
**Branding:** default VLayer (no `--brand-name` / `--brand-logo`)

> Purpose: vet every finding before this report is used as a public sales sample.
> Per the task brief: **do not publish the sample if any finding is questionable —
> report first.** This document is that report.

---

## TL;DR / Recommendation

⚠️ **Do not publish as-is yet.** Two issues remain that I could not fix here
because the brief forbids modifying scanner rules:

1. **Self-referential false positives (fixed by scoping the scan).** Scanning the
   demo root (`vlayer report .`) produced **95 findings, 62 of them false
   positives (65%)** — the scanner was re-scanning its own leftover
   `vlayer-report.json` output and matching finding *descriptions* as if they were
   vulnerable code (e.g. the text `"Weak cryptography: DES encryption"` inside the
   report was flagged as DES encryption). I avoided this by scoping the sample to
   the application source: **`vlayer report ./src`** → **33 findings, 0 self-referential FPs.**
2. **Residual quality issues in the clean (src-scoped) sample**: 4 exact duplicate
   findings and ~4 weak/generic rule mappings (details below). These are real
   scanner-rule issues, not branding issues. They are cosmetically unprofessional
   for a "flagship" sample but are **not incorrect enough to be embarrassing**.

**Verdict:** the `src`-scoped sample (33 findings) is honest and accurate, but I
recommend the scanner-rule cleanups below land before it is promoted as the public
marketing artifact. The branding/white-label work in this PR is unaffected.

---

## Part A — The headline false positive (resolved by scoping)

`vlayer report .` on the demo root scans **every** file, including the demo's
committed `vlayer-report.json` (a previous scan output). The scanner then matches
its own report text:

| Rule cluster | Count on `vlayer-report.json` | Why it's a false positive |
|---|---|---|
| `enc-weak-*` ("DES encryption") | ~20 | Matches the literal title text `"Weak cryptography: DES encryption"` inside the JSON |
| `enc-missing-*` ("SSL/TLS disabled") | ~20 | Matches finding-description text, not code |
| `CRED-003` ("Secrets via NEXT_PUBLIC_") | 13 | Matches the report's quoted code snippets |
| others | ~9 | Same root cause |
| **Total** | **62 / 95 (65%)** | Scanner scanning its own output |

**Mitigation used for the sample:** scope the scan to application source
(`vlayer report ./src`). This is a scoping choice, **not** a scanner-rule change.

**Follow-up worth considering (out of scope here):** vlayer should ignore its own
output artifacts (`vlayer-report.json`, `.vlayer/`) by default, or the demo repo
should not commit `vlayer-report.json`.

---

## Part B — Finding-by-finding review of the clean sample (`./src`, 33 findings)

The demo's two source files are **intentionally insecure** and annotated with
explicit `// VIOLATION:` comments, so true positives are expected and verifiable.

### ✅ Legitimate true positives (verified against source)

| Severity | Location | Rule | Verified? |
|---|---|---|---|
| critical | `page.tsx:25` | `phi-phi-localstorage` PHI in localStorage | ✅ `localStorage.setItem("patientCache", ...)` |
| critical | `page.tsx:25` | `HIPAA-ENC-REST-001` ePHI at rest unencrypted | ✅ same line |
| critical | `route.ts:36`, `page.tsx:27/31` | `ERROR-002` PHI in error logs | ✅ `console.log/error` of `patient.ssn`, `err.message` |
| critical | `route.ts:12` | `HIPAA-MFA-001` no MFA on PHI endpoint | ✅ unauthenticated `GET` |
| high | `route.ts:36/37` | `phi-patient-name-log`, `phi-phi-console-log`, `phi-phi-template-log` | ✅ logs `patient.name/dob/ssn/diagnosis` |
| high | `page.tsx:20` | `enc-missing` Unencrypted HTTP URL | ✅ `fetch("http://api.healthapp.local/...")` |
| high | `route.ts:67` | `ERROR-001` Unsanitized error to user | ✅ returns `error.message` |
| high | `route.ts:21/62` | `RBAC-001` PHI access without role check | ✅ no auth/role guard |
| medium | `route.ts:22` | `RBAC-003` `SELECT *` on PHI | ✅ `.select("*")` |
| medium | `route.ts:51` | `phi-address` address handling | ✅ returns `patient.address` |
| medium | `route.ts:63` | `retention-unlogged-delete` | ✅ `.delete()` with no audit log |
| medium | `page.tsx:25` | `retention-phi-cache` PHI caching | ✅ caches PHI in localStorage |

These are accurate and make a compelling demo.

### ⚠️ Exact duplicate findings (cosmetic noise — 4 pairs)

The same rule fires twice on the same `file:line` and both rows render in the
ungrouped findings table:

- `ERROR-002` @ `page.tsx:27` ×2
- `ERROR-002` @ `page.tsx:31` ×2
- `ERROR-002` @ `route.ts:36` ×2
- `ERROR-001` @ `route.ts:67` ×2

So 33 findings = **29 unique + 4 duplicates**. Not wrong, but looks sloppy in a
flagship report. Root cause is in the scanner/dedup layer (out of scope to fix here).

### ⚠️ Weak / generic rule mappings (defensible but soft)

| Location | Rule | Concern |
|---|---|---|
| `route.ts:2` | `MFA-001` "Auth config without MFA" | Fires on the `import { createClient } from "@supabase/supabase-js"` line — it's flagging an import, not a real auth config |
| `route.ts:2` | `BACKUP-001` "Database without backup config" | Also fires on the same import line — generic inference from "supabase" |
| `page.tsx:20/25/69` | `HIPAA-SEGMENT-001` "Missing Network Segmentation" ×3 | Network segmentation is an infra control; firing it on a `fetch()`, a `localStorage.setItem`, and a DELETE button is a stretch and repeats 3× |
| `project-level` | `HIPAA-PENTEST-001` "Missing Vulnerability Scanning Config" | Reasonable as advisory, but generic |

None are factually false, but a healthcare-dev buyer may push back on the
import-line and "network segmentation" mappings. Worth tightening before this is
the public sample.

### ℹ️ Informational (correct)

- `HIPAA-ASSET-001` ePHI Asset Inventory — generated artifact, correct.
- `HIPAA-FLOW-001` ePHI Flow Map — generated artifact, correct.

---

## How the sample was generated

```bash
# AI triage off → deterministic, reviewable rule-based findings.
# Scoped to ./src to avoid scanning the demo's own vlayer-report.json artifact.
env -u ANTHROPIC_API_KEY -u VLAYER_AI_KEY \
  vlayer report ~/Projects/vlayer-demo-nextjs/src --format html --output samples/sample-report.html
env -u ANTHROPIC_API_KEY -u VLAYER_AI_KEY \
  vlayer report ~/Projects/vlayer-demo-nextjs/src --format pdf  --output samples/sample-report.pdf
```

Artifacts: `samples/sample-report.html`, `samples/sample-report.pdf` (default VLayer branding).
