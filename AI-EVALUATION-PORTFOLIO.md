# AI Evaluation & Verification — Portfolio Note

`verification-layer` is a healthcare-focused static-analysis and AI-assisted verification system written in TypeScript. This note highlights the parts of the project most relevant to AI model evaluation, output verification, adversarial testing, and quality assurance.

## Evaluation problem

Static rules are useful for deterministic security checks, but they can also generate ambiguous findings and false positives when context matters. The AI-assisted layer is designed to add a second evaluation stage rather than treating a single model response as ground truth.

The project therefore combines deterministic scanning with LLM-assisted review and explicit operational controls around model usage.

## AI evaluation capabilities

The AI scanning path includes:

- Specialized LLM-powered rules for findings that require contextual interpretation
- Triage of existing static findings to classify likely false positives
- Structured finding types for AI-generated results and triaged results
- Explicit confidence and reasoning fields for AI classifications
- Cost tracking and per-scan budget limits
- Rate limiting for model calls
- Caching infrastructure
- Graceful degradation when an AI provider is unavailable
- PHI-scrubbing safeguards before external model use

## Verification philosophy

The project treats model-assisted evaluation as one layer in a larger verification system.

Key principles include:

1. **Do not silently discard failures.** Model availability and scan failures are handled explicitly.
2. **Bound model usage.** AI calls operate under budget and rate constraints.
3. **Separate deterministic findings from AI interpretation.** Static findings remain distinguishable from AI classifications.
4. **Test the evaluator itself.** Precision-focused tests cover exclusions, deduplication, acknowledgments, and false-positive behavior.
5. **Prefer reproducible evidence.** CI runs linting, type checking, builds, and automated tests across supported Node.js versions.

## Example evaluation flow

```text
Source code
   |
   v
Deterministic scanner
   |
   v
Candidate findings
   |
   +----> LLM-assisted triage ----> classification + confidence + reasoning
   |
   +----> Specialized AI rules ---> contextual AI findings
   |
   v
Verified / triaged report
```

## Relevant engineering stack

- TypeScript
- Node.js
- Anthropic SDK
- Vitest
- ESLint
- Zod
- AST parsing via `@typescript-eslint/typescript-estree`
- GitHub Actions CI/CD

## Skills demonstrated

This repository provides concrete evidence of work in:

- LLM output evaluation
- False-positive analysis
- AI-assisted classification
- Model-call reliability controls
- Adversarial and regression testing
- Static analysis
- Structured reasoning outputs
- Healthcare / HIPAA domain constraints
- TypeScript software engineering
- CI/CD and release automation

## Portfolio context

The broader goal is reliable AI: using language models where contextual judgment adds value while keeping deterministic checks, tests, auditability, and human-verifiable evidence around the model layer.
