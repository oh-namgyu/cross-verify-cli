#!/usr/bin/env node
import { program } from 'commander'
import { resolve, basename } from 'node:path'
import { existsSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runGate } from './gate.js'
import { gatherEvidence, buildPrompt } from './evidence.js'
import { runVerifier, parseVerdict, combineVerdict } from './verifier.js'
import { toMarkdown, toJson } from './report.js'

export async function crossVerify(path, opts) {
  const root = resolve(path)
  if (!existsSync(root)) throw new Error(`path not found: ${root}`)
  const mode = opts.mode || 'public-release'
  const author = opts.author || 'unknown'
  const ignore = opts.ignore ? [].concat(opts.ignore) : []

  const gate = runGate(root, { ignore, allowEmail: opts.allowEmail })

  let llm = null
  let verifierLabel = opts.verifier || '(none)'
  const sameModel = Boolean(opts.author && opts.verifier && opts.verifier.includes(author))
  if (opts.verifier) {
    const evidence = gatherEvidence(root, mode)
    const prompt = buildPrompt(evidence, { mode, gate })
    const res = await runVerifier(opts.verifier, prompt, { timeoutMs: (Number(opts.timeout) || 180) * 1000 })
    llm = res.ok ? parseVerdict(res.output) : { error: res.error, findings: [], verdict: null }
  }

  const verdict = combineVerdict(gate, llm, { sameModel })
  return { project: basename(root), root, mode, author, verifier: verifierLabel, sameModel, verdict, gate, llm }
}

const EXIT = { 'public-ready': 0, 'ready-with-notes': 0, 'gate-pass-llm-pending': 0, 'needs-fixes': 1, blocked: 2 }

program
  .name('cross-verify')
  .description('Independent pre-publish verification: deterministic gate + a different model reviews the artifact')
  .argument('<path>', 'repo or directory to verify')
  .option('--author <model>', 'the model that wrote the artifact (for the same-model guard)')
  .option('--verifier <command>', 'shell command that reads a prompt on stdin and prints the review (e.g. "claude -p")')
  .option('--mode <mode>', 'public-release | change', 'public-release')
  .option('--ignore <regex...>', 'regex(es) of file paths to skip in the gate')
  .option('--allow-email', 'do not flag email addresses as PII')
  .option('--timeout <seconds>', 'verifier timeout in seconds', '180')
  .option('-o, --out <dir>', 'write VERIFY-REPORT.{md,json} to this directory')
  .action(async (path, opts) => {
    const result = await crossVerify(path, opts)
    const md = toMarkdown(result)
    process.stdout.write(md)
    if (opts.out) {
      const dir = resolve(opts.out)
      mkdirSync(dir, { recursive: true })
      writeFileSync(resolve(dir, 'VERIFY-REPORT.md'), md)
      writeFileSync(resolve(dir, 'VERIFY-REPORT.json'), toJson(result))
      process.stderr.write(`\nReports written to ${dir}/VERIFY-REPORT.{md,json}\n`)
    }
    process.exitCode = EXIT[result.verdict] ?? 1
  })

let isMain = false
try {
  isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
} catch {
  /* not a direct CLI invocation */
}
if (isMain) program.parseAsync()
