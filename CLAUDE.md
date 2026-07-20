# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Verification Layer (`vlayer`) is a CLI tool that scans repositories for HIPAA compliance issues and generates reports. It checks for PHI exposure, encryption requirements, audit logging, access controls, and data retention policies.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm run test         # Run tests with vitest
npm run test:run     # Run tests once
npm run lint         # Lint with eslint
npm run typecheck    # Type check without emit
```

Run the CLI after building:
```bash
node dist/cli.js scan <path>              # Scan a directory
node dist/cli.js scan . -f html -o report.html  # HTML report
```

## Architecture

**Scanner Pipeline**: The CLI (`src/cli.ts`) invokes `scan()` which orchestrates category-specific scanners. Each scanner in `src/scanners/<category>/` implements the `Scanner` interface and returns `Finding[]`.

**Scanner Categories**:
- `phi/` - Detects PHI exposure (SSN, MRN, DOB patterns in code)
- `encryption/` - Finds weak crypto (MD5, DES) and missing TLS
- `audit/` - Checks for logging framework and unlogged PHI operations
- `access/` - Identifies access control issues (CORS, auth bypass, hardcoded roles)
- `retention/` - Flags improper data deletion and retention periods

**Adding a Scanner**: Create `src/scanners/<name>/index.ts` exporting a `Scanner` object, add it to `src/scan.ts` scanners map.

**Report Generation**: `src/reporters/index.ts` transforms `ScanResult` into JSON, HTML, or Markdown output.

**AI Triage** (`src/ai/`): after the static scanners run, findings are triaged by Claude Haiku 4.5 (`AI_CONFIG.triage.model`) to filter false positives. It's gated on `options.enableAI`, the config `ai.enableTriage`, and `ANTHROPIC_API_KEY` — the `--no-ai` CLI flag (or `enableAI: false` programmatically) disables it entirely for deterministic, offline runs. Triage is bounded: a hard cap of `AI_CONFIG.triage.maxFindings` (50) with a per-call timeout, and findings beyond the cap are returned regex-flagged (never dropped, with a `⚠️ Triage cap reached` warning). Calls run through a bounded `AI_CONFIG.triage.concurrency` (10) pool — ~21s for a 50-call scan, down from ~328s sequential. The 6 AI detection *rules* are a separate `ai-scan` command and stay on Sonnet.

## Type System

Core types in `src/types.ts`:
- `Finding` - Individual compliance issue with severity, location, HIPAA reference
- `Scanner` - Interface for all category scanners
- `ComplianceCategory` - Union of the 5 HIPAA categories
