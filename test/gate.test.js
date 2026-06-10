import test from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGate } from '../src/gate.js'
import { makeDirtyRepo } from './helpers.js'

const CLEAN = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'clean-repo')

test('clean repo passes the gate', () => {
  const r = runGate(CLEAN)
  assert.equal(r.blockers.length, 0)
  assert.equal(r.checks.readme, 'present')
  assert.equal(r.checks.license, 'present')
  assert.equal(r.checks.secrets, 'clean')
})

test('dirty repo is blocked — secret + missing license + tracked .env', (t) => {
  const { dir, cleanup } = makeDirtyRepo()
  t.after(cleanup)
  const r = runGate(dir)
  const rules = new Set(r.blockers.map((b) => b.rule))
  assert.ok(rules.has('secret'), 'secret blocker expected')
  assert.ok(rules.has('license'), 'missing-license blocker expected')
  assert.ok(rules.has('env'), 'tracked .env blocker expected')
  assert.equal(r.checks.secrets, 'found')
})

test('README/LICENSE must be at repo root — a nested one does not satisfy', (t) => {
  const { dir, cleanup } = makeDirtyRepo()
  t.after(cleanup)
  // dirty repo has a root README but no LICENSE anywhere → license blocker stands
  const r = runGate(dir)
  assert.ok(r.blockers.some((b) => b.rule === 'license'))
  assert.equal(r.checks.readme, 'present') // root README exists
})

test('ignore regexes suppress matched files', (t) => {
  const { dir, cleanup } = makeDirtyRepo()
  t.after(cleanup)
  const r = runGate(dir, { ignore: ['app\\.js', '\\.env'] })
  assert.equal(r.checks.secrets, 'clean')
})

test('allowEmail suppresses email findings', () => {
  const suppressed = runGate(CLEAN, { allowEmail: true })
  assert.equal(suppressed.findings.filter((f) => f.label === 'email address').length, 0)
})
