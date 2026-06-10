import test from 'node:test'
import assert from 'node:assert/strict'
import { runVerifier, parseVerdict, combineVerdict } from '../src/verifier.js'

test('runVerifier pipes prompt to stdin and captures stdout', async () => {
  const res = await runVerifier('cat', 'hello-prompt')
  assert.equal(res.ok, true)
  assert.match(res.output, /hello-prompt/)
})

test('runVerifier reports nonzero-exit errors', async () => {
  const res = await runVerifier('false', 'x')
  assert.equal(res.ok, false)
  assert.match(res.error, /exited/)
})

test('parseVerdict extracts verdict and findings', () => {
  const text = `VERDICT: needs-fixes
[high] SQL injection in query — use parameterized queries
[low] missing JSDoc — add docs`
  const p = parseVerdict(text)
  assert.equal(p.verdict, 'needs-fixes')
  assert.equal(p.findings.length, 2)
  assert.equal(p.findings[0].severity, 'high')
  assert.match(p.findings[0].fix, /parameterized/)
})

test('parseVerdict tolerates no verdict line', () => {
  assert.equal(parseVerdict('just some text').verdict, null)
})

test('combineVerdict — gate blockers always win', () => {
  const gate = { blockers: [{ rule: 'secret', message: 'x' }] }
  assert.equal(combineVerdict(gate, { verdict: 'public-ready' }, { sameModel: false }), 'blocked')
})

test('combineVerdict — same-model verifier cannot reach public-ready', () => {
  const gate = { blockers: [] }
  assert.equal(combineVerdict(gate, { verdict: 'public-ready' }, { sameModel: true }), 'ready-with-notes')
  assert.equal(combineVerdict(gate, { verdict: 'public-ready' }, { sameModel: false }), 'public-ready')
})

test('combineVerdict — no llm → gate-pass-llm-pending', () => {
  assert.equal(combineVerdict({ blockers: [] }, null, { sameModel: false }), 'gate-pass-llm-pending')
})
