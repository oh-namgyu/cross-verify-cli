import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative, extname, basename } from 'node:path'

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.venv', '__pycache__'])
const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.java', '.rs', '.md', '.json'])
const MAX_BYTES_PER_FILE = 16 * 1024
const MAX_TOTAL_BYTES = 120 * 1024

/** Collect evidence for the verifier. mode 'change' → git diff; else → file snippets. */
export function gatherEvidence(root, mode) {
  if (mode === 'change') {
    try {
      const diff = execFileSync('git', ['-C', root, 'diff', 'HEAD'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
      const staged = execFileSync('git', ['-C', root, 'diff', '--cached'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
      const combined = (staged + diff).slice(0, MAX_TOTAL_BYTES)
      return { kind: 'diff', text: combined || '(no uncommitted changes)' }
    } catch {
      return { kind: 'diff', text: '(git diff unavailable — not a git repo?)' }
    }
  }
  // public-release: snapshot of source files
  const files = []
  let total = 0
  const rec = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (total >= MAX_TOTAL_BYTES) return
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (!IGNORE_DIRS.has(e.name) && !e.name.startsWith('.')) rec(full)
      } else if (CODE_EXTS.has(extname(e.name))) {
        try {
          if (statSync(full).size > 256 * 1024) continue
          const body = readFileSync(full, 'utf8').slice(0, MAX_BYTES_PER_FILE)
          files.push({ path: relative(root, full), body })
          total += body.length
        } catch { /* skip */ }
      }
    }
  }
  rec(root)
  return { kind: 'files', files }
}

/**
 * Build the verifier prompt. CRITICAL: the author's own conclusions/context are NOT included —
 * the verifier sees only the artifact, to avoid anchoring on the author's self-assessment.
 */
export function buildPrompt(evidence, { mode, gate }) {
  const lines = [
    'You are an INDEPENDENT reviewer. Another AI model wrote the artifact below.',
    'Judge it on its own merits — you have NOT seen the author\'s reasoning, and must not assume it is correct.',
    '',
    `Review mode: ${mode}`,
    `Deterministic gate already ran. Blockers: ${gate.blockers.length === 0 ? 'none' : gate.blockers.map((b) => b.message).join('; ')}`,
    '',
    'Decide a verdict and respond with EXACTLY this format on the first line:',
    'VERDICT: <public-ready|ready-with-notes|needs-fixes|blocked>',
    'Then list findings, one per line, as: [severity] title — fix',
    '',
    '--- ARTIFACT ---',
  ]
  if (evidence.kind === 'diff') {
    lines.push('Unified diff of changes:', '', evidence.text)
  } else {
    for (const f of evidence.files) {
      lines.push(`### ${f.path}`, f.body, '')
    }
  }
  return lines.join('\n')
}
