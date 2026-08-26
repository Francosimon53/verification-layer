# VLayer Attestations

A **VLayer Attestation** is a machine-readable evidence document describing what
VLayer evaluated for one exact commit of a repository: which technical controls
were assessed, what evidence was considered, what was detected, what happened to
every finding, which exceptions remain, and what technical policy conclusion
follows.

It is the system of record. Reports (HTML, PDF, Markdown) are human-readable
views; the attestation is the underlying evidence object.

```bash
vlayer attest .                                    # generate
vlayer attest . --no-ai                            # deterministic mode
vlayer attest . --sign                             # + Sigstore signature
vlayer verify .vlayer/attestation.json             # verify (unsigned)
vlayer verify .vlayer/attestation.json \
  --bundle .vlayer/attestation.sigstore.json \
  --path .                                         # verify signature + subject
```

---

## What a VLayer Attestation proves

Within the scope it states explicitly, an attestation establishes:

- **Which source snapshot was evaluated** — a Git commit and tree SHA that any
  reviewer can recompute with `git rev-parse HEAD^{tree}`.
- **Which detection catalog produced the evaluation** — a deterministic
  `ruleCatalogDigest` over the security-relevant content of every built-in rule.
- **What was detected, and what happened to each finding** — every finding
  carries an explicit disposition. Nothing detected is discarded.
- **Which controls were actually evaluated** — backed by recorded execution
  evidence, not inferred from the absence of findings.
- **What technical policy conclusion follows** — with the policy itself pinned
  by a digest of its rules.
- **With `--sign`: who produced it** — a Sigstore keyless signature over the
  exact bytes of the attestation file.

## What a VLayer Attestation does NOT prove

VLayer does **not**:

- certify HIPAA compliance;
- make an organization HIPAA compliant;
- prove full HIPAA compliance;
- replace a formal HIPAA audit;
- evaluate every administrative safeguard;
- evaluate every physical safeguard.

**A policy `pass` means exactly:**

> The evaluated release satisfies the configured VLayer technical policy within
> the evidence scope evaluated.

It does **not** mean "the organization is HIPAA compliant", and no control is
ever labelled "compliant".

---

## Technical scope

M1 evidence is **static analysis of a repository at one commit**. Runtime, cloud,
identity and database configuration are out of scope. Every attestation carries
its own `scope.limitations[]` so a reviewer never has to infer scope from
silence.

| Field | Value |
| --- | --- |
| Schema version | `1.0.0` |
| Predicate type | `https://vlayer.app/attestation/technical-compliance/v1` |
| Envelope | in-toto Statement v1 (`https://in-toto.io/Statement/v1`) |
| Evidence class | `AUTOMATED_VERIFIED` |
| Framework | HIPAA (technical safeguards) |

---

## Git subject semantics

`vlayer attest` **requires Git**: an attestation must be bound to an immutable
commit.

| Working tree | Allowed | `sourceDigestMethod` | Subject digest | Signable |
| --- | --- | --- | --- | --- |
| Clean | yes | `git-tree-sha1` | `{ gitCommit, gitTree }` | yes |
| Dirty | only with `--allow-dirty` | `vlayer-worktree-sha256-v1` | `{ sha256 }` | **never** |

- **Clean** — the source digest is the HEAD tree object id. Git already computes
  it as a Merkle digest over the whole snapshot, so it is independently
  recomputable and is *not* a hash of the attestation itself.
- **Dirty** — a SHA-256 over the canonical sorted list of `path → sha256(content)`
  for every tracked and untracked-not-ignored file. For local evaluation only.

`--sign` combined with `--allow-dirty` is refused: a signature asserts an
identity over an immutable snapshot, and a dirty tree has none.

### Repository privacy

A Git remote can carry credentials, tokens, a private hostname and a sensitive
product name. VLayer never copies one into an attestation.

1. Userinfo, password, port, query string and fragment are **dropped at parse
   time** — they never enter a string that could be logged.
2. The remote is reduced to scheme-less `<host>/<path>`, with `.git` stripped.
3. Only an allowlist of public forges is published in full: `github.com`,
   `gitlab.com`, `bitbucket.org`, `dev.azure.com`, `codeberg.org`, `git.sr.ht`.
4. **Any other host is treated as private infrastructure and redacted**
   (`repository: null`, `repositoryHostClass: "private"`). Default-deny: an
   unknown host is more likely an internal instance whose name leaks org
   structure.
5. A stable `repositoryDigest` is always recorded, so releases of the same
   repository can be correlated over time **without disclosing its identity**.

`--repository <value>` states an identity deliberately; `--no-repository` omits
it even for a public forge.

---

## Rule catalog digest

`verifier.ruleCatalogDigest` is a SHA-256 over the built-in catalog, computed
from a fixed field selection, sorted by rule id, serialized canonically.

**Included** (changes the digest): `id`, `category`, `severity`, `source`,
`scanner`, `hipaaReference`.
**Excluded** (does not change the digest): `title`, `description`,
`recommendation`.

Prose is excluded deliberately — rewording a description changes nothing about
what VLayer detects or how it adjudicates, and a digest that churned on copy
edits would be noise. Severity, category, scanner ownership and control
references all change the evaluation and therefore do change the digest.

`npm run build` prints the digest, and `rule-catalog.json` records it.

When custom rules are active, `verifier.customRulesDigest` pins their
definitions (including the detection patterns, which *are* the semantics).

---

## Finding fingerprints

Each finding carries two identities:

- **`fingerprint`** — `SHA256(rule + repo-relative path + structural signature)`.
  **Line-independent**: the cross-release continuity key that follows an issue as
  code moves.
- **`locationId`** — `SHA256(rule + repo-relative path + line)`. The exact site.
  Contains no source content at all.

### The structural signature, precisely

Hashing raw source is **not** a privacy control: a low-entropy line such as
`const ssn = "123-45-6789"` is guessable by anyone who can enumerate candidates.
So the *pre-image itself* is made free of sensitive content, and hashing is only
a size/format convenience.

Derived from the **anchor line only** (never the surrounding context lines):

1. Strip comments.
2. Replace every string literal with `S`, template literal with `T`, numeric
   literal with `N`, and any base64/hex run ≥16 chars with `B`.
   *All literal content is destroyed here* — PHI, secrets, tokens, identifiers.
3. Replace every identifier **not** on a fixed allowlist with `I`. The allowlist
   is language keywords plus well-known API names that already appear literally
   in VLayer's own detection patterns (`console`, `log`, `createCipher`, `md5`,
   `localStorage`, …). Variable, function, table and column names — all of which
   can carry patient or business identifiers — do not survive.
4. Collapse whitespace, keep punctuation and operators.
5. Truncate to 120 characters, then SHA-256 and take 32 chars.

A representative pre-image is `console.log(S,I.I)`. Recovering it reveals nothing
the rule id does not already state.

The same normalization is what makes fingerprints **stable**: they survive
renames, reformatting and changed literal values.

**Limitation:** when no structural signature can be derived (binary file, parse
failure), the fingerprint degrades to rule + path and `structureAvailable` is
false. This is coarser, and it is recorded rather than hidden.

`baselineHashRelative` recomputes the legacy `.vlayer-baseline.json` hash over
the *relative* path. It will **not** match a baseline generated on another
machine, because the legacy hash includes the absolute path.

---

## Adjudication semantics

### Canonical rule identity

`Finding.id` is a **display** identity. Several scanners interpolate a prefix and
the line number into it (`phi-<pattern>-42`, `custom-<rule>-<file>-3`), so it does
not match the rule catalog — in a real scan, most emitted ids do not.

Rule identity is therefore **declared** by the emitting scanner via
`Finding.canonicalRuleId`, at the point where it still holds the pattern object
and knows the answer as fact. There is deliberately **no** fallback that derives
an id by stripping affixes: that would be a heuristic and a second source of
truth.

| `ruleSource` | Meaning |
| --- | --- |
| `builtin` | Resolved in `RULE_CATALOG` |
| `custom` | `custom:<id>` namespace (`:` cannot occur in a built-in id) |
| `unresolved` | Declared, but absent from this build's catalog |
| `unknown` | No identity declared |

`ruleKnown: false` maps to **no control**, contributes to the `UNMAPPED`
pseudo-control, and forces `review_required`. Unknown stays unknown.

### Dispositions

| Disposition | Meaning |
| --- | --- |
| `active` | Not adjudicated; the only blocking state |
| `false_positive` | AI triage rejected the *detection* |
| `suppressed` | Inline `// vlayer-ignore` at the code site |
| `exception` | Acknowledgment **with** an expiry, not yet expired |
| `acknowledged` | Open-ended acknowledgment |
| `baseline` | Matched `.vlayer-baseline.json` — accepted historical debt |
| `low_confidence` | Excluded by the `--min-confidence` threshold |
| `remediated` | **Reserved.** Never emitted in M1 |

**`low_confidence` is not `baseline`.** A baseline is accepted historical debt a
human recorded and removes by editing the baseline file. A low-confidence
exclusion is a detector-confidence judgement that flips the moment the threshold
changes. The legacy scan pipeline conflates them (it sets `isBaseline: true` for
both); the evidence model does not.

Detection quality travels **orthogonally** to disposition, in
`detection { semanticConfidence, minConfidenceThreshold, belowThreshold,
deterministic }`, so a blocking finding still publishes its confidence.

### Severity is not policy effect

Severity states **how serious an issue is**. Policy effect states **what it does
to this release**. They are separate fields, and severity alone never decides
whether a release is blocked.

Every finding carries:

| Field | Values |
| --- | --- |
| `evidenceScope` | `code` · `repository` |
| `policyEffect` | `blocking` · `review_required` · `none` |
| `blocking` | mirror of `policyEffect === 'blocking'` |

**`evidenceScope`** is derived generally from the finding's own shape — a finding
that cannot point at a line of source is not a code defect, it is an observation
about the repository or its process:

```
location.kind === 'project'  →  repository
location.line === null       →  repository
otherwise                    →  code
```

**`policyEffect`** follows from disposition, scope and severity:

```
disposition is not 'active'              →  none
evidenceScope is 'repository'            →  review_required   (any severity)
code + critical | high                   →  blocking
code + medium                            →  review_required
code + low | info                        →  none
```

A missing vulnerability-scanning process (`HIPAA-PENTEST-001`) is genuinely high
severity and is reported at high severity — it is a standing process gap, not a
defect this commit introduced, so auto-failing every release on it would make the
gate meaningless and train people to ignore it. A high-severity PHI leak at a
specific line is a defect in this code, and blocks.

This is a **general classification**, not an exception list: no rule id appears
in `policy.ts` or in the derivation, and no rule's severity was lowered to
achieve it. Four schema refinements make the model self-enforcing — a
repository-scope finding can never be `blocking`, `blocking` can never disagree
with `policyEffect`, an adjudicated finding always has effect `none`, and a
code-scope finding must carry a line number.

### Precedence — one deterministic rule

Evaluated in order; **first match wins**:

```
1. false_positive   AI triage rejected the detection
2. suppressed       inline // vlayer-ignore
3. exception        acknowledgment WITH expiry, unexpired
4. acknowledged     acknowledgment WITHOUT expiry
5. baseline         .vlayer-baseline.json match
6. low_confidence   below --min-confidence
7. active           default
```

Rationale: a rejected *detection* leaves nothing to adjudicate, so it precedes
every human decision. An inline comment is the narrowest, code-local statement,
so it outranks broad config globs. A time-bounded acceptance is more informative
than an open-ended one and must resurface, so it is reported when both match. A
config threshold ranks below every human decision.

### Expired acknowledgments are a lapse, not a disposition

An acknowledgment past its `expiresAt` **does not satisfy** rules 3 or 4. The
finding falls through the ladder — typically to `active`, blocking again — and a
`lapsed` record explains why it re-armed.

> **Known divergence from `vlayer scan`.** `buildReport()` computes its
> "unacknowledged" count as `!f.acknowledged`, without consulting
> `acknowledgment.expired`. An expired acknowledgment therefore keeps suppressing
> a finding in the scan JSON summary. That behavior is preserved for backwards
> compatibility (the GitHub Action parses `.summary.unacknowledged`). The
> attestation handles expiry correctly and independently, so **the two numbers
> can legitimately disagree.**

---

## Control states

VLayer never labels a regulatory control "compliant".

| State | Meaning |
| --- | --- |
| `not_evaluated` | The rules mapping to this control did not execute |
| `blocking_findings` | At least one finding with `policyEffect: blocking` |
| `review_required` | A `review_required` finding, a lapse, or a low-confidence finding |
| `exception_present` | An unexpired exception |
| `no_blocking_findings` | The mapped rules executed and produced nothing blocking |

Control states are driven by **policy effect**, not by severity and not by "is it
active": a high-severity repository/process observation is active, stays visible,
and puts its control into `review_required` rather than `blocking_findings`.

`no_blocking_findings` means exactly what it says. It is **not** a statement that
the control is satisfied.

### Control mapping

The rule→control index is built from `RULE_CATALOG.hipaaReference` **only**.
Building it from references on findings that happened to fire would be circular —
"this control was evaluated because it produced a finding" — and would make
coverage unfalsifiable.

Normalization handles every observed shape and preserves the raw text:

| Raw reference | Normalized |
| --- | --- |
| `45 CFR §164.312(b) - Audit Controls` | `164.312(b)` |
| `§164.312(b)` | `164.312(b)` |
| `NPRM §164.308(a)(3)(ii)(C) - …` | `164.308(a)(3)(ii)(C)`, `proposed: true` |
| `§164.312(a)(2)(iv), §164.312(e)(2)(ii)` | two references |
| `NPRM Anti-malware` | **unparseable → UNMAPPED** |

Unparseable references are left unmapped. Mappings are never fabricated.

Findings whose rule maps to no control land under the `UNMAPPED` pseudo-control,
which **can never** be `no_blocking_findings`.

### Evidence of execution

`no_blocking_findings` requires **proof that detection ran**. Scanners filter by
extension, so a repository with no matching files means a scanner's rules never
executed — and zero findings would otherwise look identical to a clean result.

Each scanner implements `Scanner.selectFiles()`, the *same* predicate its
`scan()` uses, so the reported count cannot drift from what was really inspected.
A scanner that does not implement it reports `filesConsidered: null` and its
controls degrade to `not_evaluated` — the safe direction.

The decision table, evaluated in order:

```
1. rulesExecuted === 0                                   → not_evaluated
2. any active + blocking finding                         → blocking_findings
3. any lapse / active non-blocking / low-confidence      → review_required
4. any unexpired exception                               → exception_present
5. otherwise                                             → no_blocking_findings
```

Row 1 is unconditional and first. The schema enforces the same invariant a second
time, so it cannot be lost in a refactor.

`scope.coverage` publishes the gaps rather than hiding them, including
`rulesWithoutControlMapping` — currently a large fraction of the catalog.

---

## Policy conclusion

Policy `vlayer-default-technical-v1`, pinned by a digest of its own rules:

```
any finding with policyEffect 'blocking'         → fail   (reason: blocking-<severity>)
any finding with policyEffect 'review_required'  → review_required
any lapsed adjudication                          → review_required
any open (unexpired) exception                   → review_required
any control state not_evaluated                  → review_required
any unknown rule identity                        → review_required
otherwise                                        → pass
```

The policy reads `policyEffect`, never `severity` — severity is still recorded in
the reason (`blocking-critical`, `blocking-high`) so the conclusion stays
actionable. Active `low` and `info` code findings do not block. Repository/process
observations require review and never auto-fail. **Absence of evidence is never a
pass.**

> **Known divergence from `vlayer scan`.** `vlayer scan` exits 1 whenever any
> critical *group* exists, including one fully acknowledged, suppressed or
> baselined. The attestation policy operates on **active** findings only. Both
> gates are kept; `scan` is unchanged for backwards compatibility.

M1 ships this one fixed policy. A policy DSL is deliberately out of scope.

---

## Privacy model

The shareable attestation **may** contain: repository-relative paths, line
numbers, stable rule ids, severity, category, control references, digests,
dispositions, confidence values, timestamps, Git metadata, scanner metadata and
policy metadata.

It **must never** contain: source code, PHI values, secrets, credentials, API
keys, AI prompts, raw AI reasoning, absolute filesystem paths, or raw Git remote
URLs.

This is enforced **structurally, not by filtering**: `FindingEvaluation` declares
no `title`, `description`, `recommendation`, `context`, `snippet` or `code`
field, and every schema object is `.strict()`. An accidental object spread fails
validation *before* anything is written.

User-authored free text is digested, never published:

| Field | In the attestation |
| --- | --- |
| AI reasoning prose | `aiTriage.reasoningDigest` (SHA-256) |
| Acknowledgment reason | `reasonDigest` |
| Acknowledger identity | `byDigest` |
| Suppression reason | `reasonDigest` |

Local audit evidence (`.vlayer/audit-trail.json`) remains richer and is **not**
shareable.

---

## Determinism and reproducibility

### Canonical serialization

`.vlayer/attestation.json` is written as **canonical JSON** (RFC 8785 subset):
keys sorted by UTF-16 code unit, compact, no trailing newline, `undefined`
omitted rather than nulled, and **integers only** — fractions are carried as
scaled integers (`confidencePermille`), which removes float-serialization
non-determinism entirely instead of trusting a serializer.

The file is compact rather than pretty-printed because **the file on disk is the
signed payload**. Use `vlayer verify <file> --print` to read it comfortably; the
file is not modified.

### What "deterministic" means

> For the same commit, the same rule catalog digest, the same configuration and
> `--no-ai`, every field is byte-identical **except `generatedAt`**.

The clock is injected (`buildAttestation(opts, { now })`) so this is directly
testable. These components are deterministic for identical inputs regardless of
the clock: `ruleCatalogDigest`, `customRulesDigest`, every `fingerprint` and
`locationId`, `policy.digest`, `target.sourceDigest`, and all control mappings
and states.

### Deterministic detection vs AI-assisted adjudication

AI triage is **not** reproducible: sampling, model updates, timeouts and the
per-scan cap all mean a re-run may classify differently.

| | Reproducible from the commit alone? |
| --- | --- |
| **Deterministic detection evidence** — static detection, fingerprints, control mapping, acknowledgment/suppression/baseline/threshold adjudication | Yes |
| **AI-assisted adjudication** — the `false_positive` disposition and `aiTriage` metadata | **No** |

The predicate records the truth:

```jsonc
"aiTriage": {
  "enabled": true, "applied": true,
  "model": "claude-haiku-4-5-20251001",
  "findingsSubmitted": 40,
  "findingsCapped": 0,       // beyond the cap: regex-flagged only, NOT AI-verified
  "findingsFailed": 0,
  "reproducible": false      // literally false whenever applied
}
```

`scope.reproducibility` is `deterministic` or `ai-assisted`. Per finding,
`detection.deterministic` is false **only** for evaluations the AI actually
influenced, so a reviewer can partition the evidence rather than discount the
whole document.

**`--no-ai` is the strongest reproducibility mode and is recommended for signed
release attestations.** Signing with AI applied is allowed but warns, and records
`reproducible: false`.

---

## Signing model

Two layers, deliberately not merged:

- **A. VLayer semantic attestation** — the in-toto Statement v1 JSON. There is no
  second semantic envelope.
- **B. Sigstore cryptographic proof** — a bundle signing the **exact bytes** of
  `.vlayer/attestation.json`.

VLayer uses `sigstore.sign(bytes)` / `sigstore.verify(bundle, bytes)`, **not**
`sigstore.attest()`/DSSE. DSSE embeds a copy of the payload inside the bundle and
`verify(bundle)` checks that embedded copy — so a swapped attestation file would
still verify against a bundle describing a different statement. Signing the
artifact bytes means verification **cannot succeed** without the exact bytes the
reviewer is reading. Changing one byte — including re-serializing the same
content with different whitespace — fails verification cryptographically, with no
separate equality check to trust.

Signing is **optional**. Existing SHA-256 audit hashes elsewhere in VLayer are
integrity primitives, **not** authenticated signatures, and are never described
as "signed".

### Identity: CI only

Keyless signing needs an **ambient OIDC identity**. `sigstore-js` 5.x ships
exactly one identity provider — `CIContextProvider` — which reads either
GitHub Actions' `ACTIONS_ID_TOKEN_REQUEST_URL` / `ACTIONS_ID_TOKEN_REQUEST_TOKEN`,
or a pre-obtained `SIGSTORE_ID_TOKEN`.

**There is no local interactive browser flow.** The browser-based OAuth flow
people associate with Sigstore lives in `cosign` and `sigstore-python`, not in
this library. Running `vlayer attest . --sign` on a laptop with no OIDC identity
will fail, by design and unavoidably.

| Path | How | Status |
| --- | --- | --- |
| **GitHub Actions** | `permissions: { id-token: write }` | **Supported.** The intended and tested route. |
| **`SIGSTORE_ID_TOKEN`** | Obtain a Sigstore-acceptable OIDC token by other means (e.g. `sigstore get-identity-token` from sigstore-python) and export it | Advanced. Tokens are short-lived; this is an escape hatch, not the normal path. |
| Local interactive browser | — | **Does not exist.** |

### When a signature is requested and cannot be produced

Requesting a signature and silently getting an unsigned artifact is the most
dangerous shape this command can take: the next pipeline step ships something it
believes is signed. Note that `$?` after a pipe reports the *last* stage, so
`vlayer attest . --sign | tee log` hides a non-zero exit.

So `--sign` is **atomic**:

- On success, `attestation.json` **and** the bundle are written together.
- On failure, **nothing is written** — not to the output path, and not to any
  nearby quarantine name. A second artifact would still be found by a glob such
  as `.vlayer/*.json` and invites a "just rename it" workaround; absence cannot
  be misread.
- The exit code is **`3`**, distinct from `1` (general failure), and stderr
  carries the stable marker `vlayer:signing-failed`.

| Outcome | Exit | `attestation.json` | Bundle |
| --- | --- | --- | --- |
| Unsigned **by request** (no `--sign`) | `0` | present | absent |
| Signed successfully | `0` | present | present |
| Signature **requested and failed** | `3` | **absent** | absent |

A script therefore never has to parse prose to tell "deliberately unsigned" from
"signing broke".

Files:

```
.vlayer/attestation.json           # the attestation (the signed payload)
.vlayer/attestation.sigstore.json  # the Sigstore bundle
```

---

## Verification model

`vlayer verify` reports **four independent verdicts**. They are never collapsed
into one word, and a failure in one does not suppress the others — a tampered
file that also breaks the schema still reports its signature as invalid, not as
"unsigned".

| Verdict | Values |
| --- | --- |
| **Schema** | `valid` · `invalid` (with per-field errors) |
| **Subject** | `valid` · `mismatch` · `not_checked` (no `--path`) |
| **Signature** | `not_provided` · `valid` · `invalid` · `not_verifiable` |
| **Policy** | `pass` · `fail` · `review_required` |

- **Unsigned** attestations are legitimate and complete. They report
  `signature: not_provided`, and VLayer never calls them "cryptographically
  verified".
- **`not_verifiable`** means Sigstore could not run. It is never reported as
  `valid`, and never silently downgraded to unsigned.

Exit code is non-zero when the schema is invalid, the subject mismatches, the
signature is invalid or not verifiable, or the policy conclusion is `fail`.
A `review_required` conclusion exits zero **by design** — it means a human must
look, not that the release failed.

---

## GitHub Actions

Existing users of `.github/actions/hipaa-scan` are unaffected — the new inputs
default to `false` and their steps are `if:`-gated.

```yaml
permissions:
  contents: read
  id-token: write        # REQUIRED for sign-attestation

steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/hipaa-scan
    with:
      path: .
      generate-attestation: 'true'
      sign-attestation: 'true'
```

Outputs: `attestation-path`, `policy-conclusion`. Generated files are uploaded as
the `vlayer-attestation` artifact.

---

## Current limitations

1. **Code evidence only.** No runtime, cloud, identity or database evidence. No
   administrative or physical safeguards.
2. **Control coverage is incomplete.** A large fraction of catalog rules carry no
   parseable control reference and map to no control. Published as
   `scope.coverage.rulesWithoutControlMapping`; not silently treated as coverage.
3. **AI triage metrics come from explicit state.** `TriagedFinding.triageOutcome`
   (`ai_verified` · `cap_reached` · `no_content` · `error` · `unavailable`) is the
   single source of truth for `verifier.aiTriage.*`. `aiReasoning` is prose and is
   never parsed — rewording it cannot change reported evidence.
4. **`remediated` is never emitted.** M1 evaluates a single release and cannot
   prove remediation; that requires cross-release diffing.
5. **No cross-release history.** Fingerprints are designed for continuity, but M1
   does not compare two attestations.
6. **`baselineHashRelative` does not match existing baseline files** generated on
   another machine, because the legacy hash includes the absolute path.
7. **Exception expiry granularity.** An exception's `expiresAt` comes from
   `.vlayerrc.json`; VLayer does not manage exception lifecycles.
8. **Signing requires OIDC.** There is no offline/key-file signing mode.
9. **Attestation and scan summaries can legitimately disagree** on expired
   acknowledgments and on critical-severity gating (see the two divergence notes
   above).
10. **The structural fingerprint discloses grammar shape.** The pre-image contains
   no literals or non-allowlisted identifiers, but it does reveal the shape of the
   flagged construct — which the rule id already states. Accepted, and documented.
