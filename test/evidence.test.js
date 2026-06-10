import test from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gatherEvidence, buildPrompt } from '../src/evidence.js'

const CLEAN = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'clean-repo')

test('gatherEvidence (public-release) snapshots source files', () => {
  const ev = gatherEvidence(CLEAN, 'public-release')
  assert.equal(ev.kind, 'files')
  assert.ok(ev.files.some((f) => f.path === 'index.js'))
})

test('buildPrompt instructs independence and never leaks author conclusions', () => {
  const ev = gatherEvidence(CLEAN, 'public-release')
  const gate = { blockers: [], checks: {}, findings: [] }
  const prompt = buildPrompt(ev, { mode: 'public-release', author: 'claude', gate })
  // independence framing present
  assert.match(prompt, /INDEPENDENT reviewer/)
  assert.match(prompt, /have NOT seen the author/)
  // strict verdict format requested
  assert.match(prompt, /VERDICT: <public-ready\|ready-with-notes\|needs-fixes\|blocked>/)
  // the author's name/conclusion must NOT appear in the prompt (anti-anchoring)
  assert.doesNotMatch(prompt, /author model is|author says|claude/i)
})
