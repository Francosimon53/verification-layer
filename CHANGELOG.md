# [0.15.0](https://github.com/Francosimon53/verification-layer/compare/v0.14.0...v0.15.0) (2026-02-06)


### Features

* implement Phase 4A - Next.js Web Dashboard ([8e183e3](https://github.com/Francosimon53/verification-layer/commit/8e183e35c42a88f7446e93829c85e0dfd16ba473))

# [0.14.0](https://github.com/Francosimon53/verification-layer/compare/v0.13.0...v0.14.0) (2026-02-06)


### Bug Fixes

* remove unused imports to resolve linting errors ([5fd275e](https://github.com/Francosimon53/verification-layer/commit/5fd275e092774d152642e0da7377ded601d2e635))


### Features

* implement Phase 3B - Dashboard & Compliance Score ([1f25b31](https://github.com/Francosimon53/verification-layer/commit/1f25b31c26f94f4c44ff6bf7281d98b14d8a9db1))

# [0.13.0](https://github.com/Francosimon53/verification-layer/compare/v0.12.0...v0.13.0) (2026-02-06)


### Features

* implement Phase 3A - IDE & Developer Experience ([152754d](https://github.com/Francosimon53/verification-layer/commit/152754d841cfaf2017c0d4e9dd2ca38221224905))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase 3A: IDE & Developer Experience

#### Added - VS Code Extension v2.0.0
- **Real-time scanning**: Automatic HIPAA compliance scanning on file save
- **Inline diagnostics**: Error/warning markers with severity and confidence levels
- **Hover tooltips**: Rich information showing HIPAA references, descriptions, and recommendations
- **Quick-fix actions**: Apply auto-fixes directly from the editor
- **Status bar integration**: Live compliance score for the current file
- **Commands**:
  - `VLayer: Scan Current File` - Scan the active file
  - `VLayer: Scan Workspace` - Scan entire workspace
  - `VLayer: Clear Diagnostics` - Clear all diagnostics
- **Configuration options**:
  - `vlayer.enableAutoScan` - Enable/disable auto-scan on save
  - `vlayer.minConfidence` - Set minimum confidence level threshold
  - `vlayer.showStatusBar` - Show/hide compliance score
  - `vlayer.configPath` - Custom configuration file path

#### Added - Watch Mode
- **CLI watch command**: `vlayer watch <path>` for continuous monitoring
- **Real-time scanning**: Automatic scan on file save/create
- **Colored output**: Terminal output with severity-based colors
- **Diff tracking**: Shows new findings vs. previous scan
- **Critical alerts**: Notifications for new critical/high severity findings
- **Smart filtering**: Excludes node_modules, dist, build directories by default

## [0.12.0] - 2026-02-06

### Fixed
- Resolved linting errors (unused variables, unused imports)
- Updated baseline with 89 current findings
- All 270 tests passing
