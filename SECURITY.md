# Security Policy

## Trust model — read this first

**`--verifier` runs an arbitrary shell command.** cross-verify spawns whatever you pass via a
shell so you can use pipelines and arguments freely (`"claude -p"`, `"ollama run llama3"`, a
wrapper script). That means:

- Only pass `--verifier` commands you trust. Treat it like any command you'd type yourself.
- Do not feed an untrusted, attacker-controlled string into `--verifier`.
- The artifact being reviewed is sent to that command's stdin — if your verifier is a remote
  API, the repo's source (or diff) leaves your machine. Use a local verifier for private code.

## What it does and doesn't do

- It reads files under the path you give it and (in `change` mode) runs `git diff`. It writes
  only the report files you request with `-o`.
- The deterministic gate is best-effort: conservative secret/PII regexes that catch common
  cases, not a guarantee. A clean gate is **not** proof a repo is secret-free.
- The same-model guard is a **substring** comparison of `--author` against the `--verifier`
  command. It can false-positive (short author names) and false-negative (`claude-opus` vs a
  `claude` command). It's a safety nudge, not a strong identity check.

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub Security Advisories on this repository
("Report a vulnerability"). Please do not open public issues for security reports.
