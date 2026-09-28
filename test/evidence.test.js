import test from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
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

test('change mode: staged hunks appear once and untracked files are included', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cv-change-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a])
  git('init', '-q')
  writeFileSync(join(dir, 'a.js'), 'one\n')
  git('add', '.')
  git('commit', '-qm', 'init')
  writeFileSync(join(dir, 'a.js'), 'one\nSTAGED_LINE\n')
  git('add', 'a.js')
  writeFileSync(join(dir, 'new.js'), 'UNTRACKED_LINE\n')
  const { text } = gatherEvidence(dir, 'change')
  assert.equal(text.split('STAGED_LINE').length - 1, 1)
  assert.match(text, /UNTRACKED_LINE/)
})
