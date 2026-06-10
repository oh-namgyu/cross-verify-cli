import { spawn } from 'node:child_process'

const VERDICTS = ['public-ready', 'ready-with-notes', 'needs-fixes', 'blocked']

/**
 * Run the verifier command, piping `prompt` to its stdin and capturing stdout.
 * The command is run via the shell so users can pass pipelines/args freely
 * (e.g. "claude -p", "ollama run llama3"). This is arbitrary command execution —
 * callers must only pass commands they trust (see SECURITY.md).
 */
export function runVerifier(command, prompt, { timeoutMs = 180_000 } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (err) {
      return resolve({ ok: false, error: `spawn failed: ${err.message}`, output: '' })
    }
    let out = '', err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ ok: false, error: `verifier timed out after ${timeoutMs}ms`, output: out })
    }, timeoutMs)
    timer.unref?.()
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, error: e.message, output: out })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out.trim()) {
        resolve({ ok: false, error: `verifier exited ${code}: ${err.trim().slice(0, 200)}`, output: out })
      } else {
        resolve({ ok: true, output: out })
      }
    })
    // A verifier that exits before draining stdin (e.g. doesn't read it) makes the
    // write fail with EPIPE; swallow it — the verifier's output is what matters.
    child.stdin.on('error', () => {})
    child.stdin.end(prompt)
  })
}

/** Parse the verifier's free text into {verdict, findings[]}. Tolerant of formatting drift. */
export function parseVerdict(text) {
  const verdictMatch = text.match(/VERDICT:\s*(public-ready|ready-with-notes|needs-fixes|blocked)/i)
  const verdict = verdictMatch ? verdictMatch[1].toLowerCase() : null
  const findings = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]?\s*\[(\w+)\]\s*(.+)/)
    if (m) {
      const [, severity, rest] = m
      const [title, ...fixParts] = rest.split('—')
      findings.push({ severity: severity.toLowerCase(), title: title.trim(), fix: fixParts.join('—').trim() || null })
    }
  }
  return { verdict, findings, raw: text.trim() }
}

/** Combine gate + LLM into a final verdict. Gate blockers always win. */
export function combineVerdict(gate, llm, { sameModel }) {
  if (gate.blockers.length > 0) return 'blocked'
  if (!llm || !llm.verdict) return 'gate-pass-llm-pending'
  // a same-model verifier can't be fully trusted to be independent; never let it upgrade past ready-with-notes
  if (sameModel && llm.verdict === 'public-ready') return 'ready-with-notes'
  return llm.verdict
}

export { VERDICTS }
