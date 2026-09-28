# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Security

- A secret blocker now skips the verifier entirely, so evidence containing a detected secret is never sent to a (possibly remote) model.
- `.env` variants such as `.env.local` are blockers and are scanned for secrets; `.env.example` / `.sample` / `.template` stay allowed.

### Fixed

- `--mode change` no longer duplicates staged hunks and now includes untracked files in the evidence.

## [v0.1.0] - 2026-06-19
### Added
- Initial public release.
