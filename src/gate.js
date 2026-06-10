import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.venv', '__pycache__'])
const TEXT_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.java', '.json',
  '.yml', '.yaml', '.env', '.sh', '.md', '.txt', '.cfg', '.ini', '.toml', ''])
const MAX_FILE_BYTES = 512 * 1024

// Secret patterns — conservative, high-signal. Each: [label, regex].
const SECRET_PATTERNS = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['OpenAI key', /sk-[A-Za-z0-9]{20,}/],
  ['Anthropic key', /sk-ant-[A-Za-z0-9-]{20,}/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['generic assigned secret', /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
]
// PII patterns — narrow to avoid noise.
const PII_PATTERNS = [
  ['email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['US SSN', /\b\d{3}-\d{2}-\d{4}\b/],
]

function walk(root, ignore) {
  const out = []
  const rec = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      const rel = relative(root, full)
      if (ignore.some((re) => re.test(rel))) continue
      if (e.isDirectory()) {
        if (!IGNORE_DIRS.has(e.name)) rec(full)
      } else if (TEXT_EXTS.has(extname(e.name))) {
        try {
          if (statSync(full).size <= MAX_FILE_BYTES) out.push({ rel, full })
        } catch { /* skip */ }
      }
    }
  }
  rec(root)
  return out
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length

/**
 * Deterministic pre-publish gate. No LLM. Returns {checks, blockers, findings}.
 * blockers (non-empty → verdict 'blocked' regardless of LLM): secrets, missing LICENSE/README, tracked .env.
 */
export function runGate(root, { ignore = [], allowEmail = false } = {}) {
  const ignoreRes = ignore.map((g) => new RegExp(g))
  const files = walk(root, ignoreRes)
  const findings = []
  const blockers = []

  // README/LICENSE must be at the repo ROOT — a nested fixtures/README must not mask a missing one.
  const rootNames = files.filter((f) => !f.rel.includes('/')).map((f) => f.rel.toLowerCase())
  const hasReadme = rootNames.some((n) => n.startsWith('readme'))
  const hasLicense = rootNames.some((n) => n.startsWith('license') || n.startsWith('licence') || n === 'copying')
  const envTracked = files.some((f) => basename(f.rel) === '.env')

  if (!hasReadme) blockers.push({ rule: 'readme', message: 'No README found' })
  if (!hasLicense) blockers.push({ rule: 'license', message: 'No LICENSE found' })
  if (envTracked) blockers.push({ rule: 'env', message: '.env is tracked in the tree' })

  for (const f of files) {
    let text
    try {
      text = readFileSync(f.full, 'utf8')
    } catch {
      continue
    }
    for (const [label, re] of SECRET_PATTERNS) {
      const m = re.exec(text)
      if (m) {
        const finding = { rule: 'secret', severity: 'critical', label, file: f.rel, line: lineOf(text, m.index) }
        findings.push(finding)
        blockers.push({ rule: 'secret', message: `${label} in ${f.rel}:${finding.line}` })
      }
    }
    for (const [label, re] of PII_PATTERNS) {
      if (allowEmail && label === 'email address') continue
      const m = re.exec(text)
      if (!m) continue
      // emails in markdown docs are usually contact info → info, not warning
      const isDoc = extname(f.rel) === '.md'
      findings.push({
        rule: 'pii',
        severity: isDoc && label === 'email address' ? 'info' : 'warning',
        label,
        file: f.rel,
        line: lineOf(text, m.index),
      })
    }
  }

  return {
    checks: {
      readme: hasReadme ? 'present' : 'missing',
      license: hasLicense ? 'present' : 'missing',
      env_tracked: envTracked,
      secrets: findings.some((f) => f.rule === 'secret') ? 'found' : 'clean',
      files_scanned: files.length,
    },
    blockers,
    findings,
  }
}
