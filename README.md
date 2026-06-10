# cross-verify-cli

Pre-publish verification where **the model that wrote the code is never the one that approves it.**

`cross-verify` runs two layers over a repo or a diff:

1. **A deterministic gate** (no LLM) — scans for secrets, PII, a tracked `.env`, and missing
   LICENSE/README. Any hit forces the verdict to `blocked`, regardless of what any model says.
2. **An independent second-model review** — pipes the artifact (and *not* your reasoning) to a
   verifier command you choose, so a *different* model judges it on its own merits.

The output is a `VERIFY-REPORT.{md,json}` and an exit code you can gate CI on.

## Why

AI agents increasingly write the code *and* get asked "does this look good?" — and they tend
to approve their own work. cross-verify breaks that loop two ways: a hard, model-agnostic gate
that no LLM can talk its way past, and an **independent verifier** that never sees the author's
self-assessment (anti-anchoring). If the author and verifier are the same model, the tool says
so and refuses to let it reach `public-ready`.

## Quick start

```bash
git clone https://github.com/oh-namgyu/cross-verify-cli && cd cross-verify-cli
npm install

# gate only (no LLM) — secrets / license / readme / .env
node src/cli.js /path/to/repo

# gate + an independent verifier of your choice
node src/cli.js /path/to/repo --author claude --verifier "codex exec" -o .
node src/cli.js /path/to/repo --author gpt    --verifier "ollama run llama3"
```

The `--verifier` command receives the review prompt on **stdin** and is expected to print its
review to **stdout**. Anything that does that works — a CLI agent, an API wrapper script, a
local model. cross-verify itself ships **no model and no API keys**.

## Usage

```
cross-verify <path> [options]

  --author <model>       the model that wrote the artifact (enables the same-model guard)
  --verifier <command>   shell command: reads prompt on stdin, prints review on stdout
  --mode <mode>          public-release (snapshot files) | change (git diff)   [public-release]
  --ignore <regex...>    regex(es) of file paths to skip in the gate
  --allow-email          do not flag email addresses as PII
  --timeout <seconds>    verifier timeout                                       [180]
  -o, --out <dir>        write VERIFY-REPORT.{md,json} into <dir>
```

### Verdict & exit codes

| verdict | exit | meaning |
|---|---|---|
| `public-ready` | 0 | gate clean + verifier approved |
| `ready-with-notes` | 0 | approved with non-blocking notes (also the cap for a same-model verifier) |
| `gate-pass-llm-pending` | 0 | gate clean but no verifier was run (gate-only mode) |
| `needs-fixes` | 1 | verifier found issues to fix |
| `blocked` | 2 | gate blocker (secret / missing license / tracked `.env`) — overrides the LLM |

## How the independence works

- The verifier prompt contains the **artifact only** — never the author's conclusions — so the
  reviewer can't anchor on "the author thinks this is fine."
- The deterministic gate is pure static analysis; its blockers **always** win over the LLM
  verdict. A model cannot approve away a committed secret.
- `--author` + `--verifier` are compared; if the verifier command names the same model, the
  report is marked `⚠️ same model` and capped at `ready-with-notes`. (This is a substring
  heuristic — see its limits in [SECURITY.md](SECURITY.md).)

## Limitations (v0.1)

- Secret/PII patterns are conservative and high-signal; tune with `--ignore`. They report the
  first hit per pattern per file (enough for pass/block, not a full secret inventory).
- No built-in API adapters — bring your own verifier command (a one-line wrapper covers any API).
- JS/TS/py/etc. text files only for the gate scan.

## Development

```bash
npm test
```

MIT — see [LICENSE](LICENSE). Security & trust model: [SECURITY.md](SECURITY.md).
