# vlayer Compliance Delivery

`vlayer` can operate as a change-oriented compliance control in addition to a repository scanner. The delivery layer answers a narrower release question:

> Did this software change introduce compliance risk that violates our delivery policy?

The `vlayer-ci` binary is designed for pull requests and deployment pipelines. It keeps existing baseline debt visible without allowing historical findings to make every future pull request fail.

## 1. Create a portable baseline

```bash
vlayer baseline . -o .vlayer-baseline.json
```

Baseline format 2.0 stores project-relative paths and stable semantic fingerprints. Line numbers are retained for display but are not part of the fingerprint, so a line shift or a different CI checkout directory does not invalidate the baseline.

Commit `.vlayer-baseline.json` with the repository when you want the current accepted state to be the starting point for change detection.

## 2. Define delivery policy

Create `vlayer.policy.json`:

```json
{
  "blockOn": ["critical", "high"],
  "maxNew": {
    "medium": 3
  },
  "changedFilesOnly": true,
  "minimumScore": 0,
  "requireBaseline": true,
  "failOnExpiredAcknowledgments": true
}
```

Policy can also live at `.vlayer/policy.json` or in a `deliveryPolicy` block inside `.vlayerrc.json`. An explicit `--policy` file takes precedence.

### Policy semantics

- `blockOn`: any new active finding at one of these severities blocks deployment.
- `maxNew`: numeric budget for new findings by severity.
- `changedFilesOnly`: evaluate newly introduced findings only in files changed by the Git comparison when Git metadata is available.
- `minimumScore`: optional whole-repository compliance score floor.
- `requireBaseline`: fail when no baseline is available.
- `failOnExpiredAcknowledgments`: treat expired exceptions as governance failures.

Acknowledged and inline-suppressed findings are not considered new active risk. Expired acknowledgments do not suppress findings.

## 3. Gate a pull request

```bash
vlayer-ci guard . \
  --baseline .vlayer-baseline.json \
  --policy vlayer.policy.json \
  --base main \
  --output vlayer-guard.json
```

Exit codes:

- `0`: policy passed; deployment is allowed.
- `2`: scan completed but delivery policy blocked the change.
- `1`: operational failure.

AI triage is disabled by default for deterministic CI decisions. Use `--ai` only when a team deliberately wants model-assisted triage in the gate.

## 4. Generate audit evidence

```bash
vlayer-ci evidence . \
  --baseline .vlayer-baseline.json \
  --policy vlayer.policy.json \
  --base main \
  -o vlayer-evidence.json
```

The evidence package contains:

- source-control provenance (repository, base/head SHA, branch, author when available),
- delivery decision and policy reasons,
- new and resolved finding counts,
- normalized finding metadata,
- mapped HIPAA controls,
- a code-to-control compliance graph,
- a SHA-256 package hash.

Evidence deliberately excludes source-code context snippets. This reduces the chance that PHI, credentials, or application secrets are copied into an audit artifact.

Verify a stored package:

```bash
vlayer-ci verify-evidence vlayer-evidence.json
```

Any modification to the hashed package body causes verification to fail.

## 5. Compliance graph

```bash
vlayer-ci graph . \
  --baseline .vlayer-baseline.json \
  --base main \
  -o vlayer-compliance-graph.json \
  --mermaid vlayer-compliance-graph.mmd
```

The graph relates:

```text
code -> finding -> HIPAA control -> delivery policy
              \-> owner
 evidence ----> finding
 evidence ----> policy decision
```

This is a machine-readable foundation for workspace reporting, evidence search, and agent reasoning rather than a UI-only diagram.

## 6. Exception lifecycle

```bash
vlayer-ci exceptions . --config .vlayerrc.json
```

The command reports active, expired, and soon-to-expire acknowledgments. It exits `2` when expired exceptions exist so an organization can make exception review a scheduled governance control.

An acknowledgment should include an owner, reason, date, ticket, and expiry whenever practical. Expiry means re-review, not permanent suppression.

## 7. Compliance agent

```bash
vlayer-ci agent . --baseline .vlayer-baseline.json --base main
```

The agent command converts the delivery decision into a remediation plan with file, rule, recommendation, and whether a deterministic vlayer fix exists.

To apply only registered deterministic fix strategies and then re-run the gate:

```bash
vlayer-ci agent . \
  --baseline .vlayer-baseline.json \
  --base main \
  --apply-safe-fixes \
  --markdown vlayer-remediation.md
```

`--apply-safe-fixes` mutates source files and should therefore be invoked deliberately on a working branch. It never authorizes an AI-generated arbitrary code change.

## GitHub Actions

A reusable example is included at `templates/github-actions/compliance-gate.yml`.

The important requirements are:

1. Checkout with `fetch-depth: 0` so the base/head comparison is available.
2. Run `vlayer-ci guard` before deployment.
3. Generate the evidence package even when the gate blocks.
4. Upload the guard result and evidence JSON as CI artifacts.

## Security model

The delivery layer is a static-analysis and policy-enforcement system, not a certification authority. A passing gate means the configured automated controls found no change that violates the configured policy. It is not a legal attestation that an organization is HIPAA compliant.
