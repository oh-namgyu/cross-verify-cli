# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [0.2.0] - 2026-10-16

### Changed

- **Node.js 22 is now the minimum** (`engines.node` is `>=22.12.0`). The previous `>=20` was already untrue: `commander` 15 requires `>=22.12.0`, so `npm install` on Node 20 printed `EBADENGINE` warnings. Node 20 reached end-of-life in April 2026.
- CI tests on Node 22 and 24 (Node 20 dropped).

## [0.1.1] - 2026-10-16

### Security

- A secret blocker now skips the verifier entirely, so evidence containing a detected secret is never sent to a (possibly remote) model. Upgrade if you point the verifier at a hosted model.
- `.env` variants such as `.env.local` are blockers and are scanned for secrets; `.env.example` / `.sample` / `.template` stay allowed.

### Fixed

- `--mode change` no longer duplicates staged hunks and now includes untracked files in the evidence.

### Changed

- Dependency: `commander` `^13.0.0` → `^15.0.0`.
- CI tests on Node 20, 22 and 24; CI actions bumped (`actions/checkout` 4 → 7, `actions/setup-node` 4 → 7, `dependabot/fetch-metadata` 2 → 3).
- Dependabot weekly updates for npm (production/dev groups) and GitHub Actions, with auto-merge of patch/minor updates once checks pass.
- README: Korean summary at the top, CI/License/Release badges, and a `License` section that links `SECURITY.md`.

## [0.1.0] - 2026-06-19
### Added
- Initial public release.
