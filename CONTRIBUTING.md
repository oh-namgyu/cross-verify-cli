# Contributing to cross-verify-cli

Thanks for your interest!

## Development setup

```bash
npm install
npm test            # node --test
node src/cli.js --help
```

## Guidelines

- The verifier command is **arbitrary command execution by design** (you pass
  the command). Keep the trust model and timeout/process-group handling in
  `src/verifier.js` intact, and read [SECURITY.md](SECURITY.md).
- Add a regression test for any bug fix (`test/`).
- Run `npm test` before opening a PR; describe what changed and how you verified it.
