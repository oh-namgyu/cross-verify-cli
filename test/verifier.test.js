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

test('runVerifier survives a verifier that ignores a huge stdin (EPIPE)', async () => {
  // 'true' exits immediately without reading stdin; a prompt larger than the
  // pipe buffer would crash on EPIPE without the stdin error handler.
  const res = await runVerifier('true', 'x'.repeat(2 * 1024 * 1024))
  assert.equal(res.ok, true)
})

test('runVerifier times out (and resolves) on a long-running verifier', async () => {
  const start = Date.now()
  const res = await runVerifier('sleep 5', 'x', { timeoutMs: 150 })
  assert.equal(res.ok, false)
  assert.match(res.error, /timed out/)
  assert.ok(Date.now() - start < 3000, 'should resolve at the timeout, not after sleep')
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

test('parseVerdict ignores markdown checkboxes and bracketed prose', () => {
  const text = `VERDICT: ready-with-notes
- [x] a done checklist item
- [ ] a todo checklist item
see the [config] section for details
[low] a real finding — fix it`
  const p = parseVerdict(text)
  assert.equal(p.findings.length, 1)
  assert.equal(p.findings[0].severity, 'low')
  assert.match(p.findings[0].fix, /fix it/)
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
