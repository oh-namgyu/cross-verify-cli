import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { makeDirtyRepo } from './helpers.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI = join(ROOT, 'src', 'cli.js')
const CLEAN = join(ROOT, 'fixtures', 'clean-repo')
const run = (args) =>
  promisify(execFile)(process.execPath, [CLI, ...args]).then(
    (r) => ({ code: 0, out: r.stdout }),
    (e) => ({ code: e.code, out: (e.stdout || '') + (e.stderr || '') })
  )

test('dirty repo → exit 2 (blocked), report shows blockers', async (t) => {
  const { dir, cleanup } = makeDirtyRepo()
  t.after(cleanup)
  const r = await run([dir])
  assert.equal(r.code, 2)
  assert.match(r.out, /Verdict: \*\*blocked\*\*/)
  assert.match(r.out, /Blockers/)
})

test('clean repo, gate-only → exit 0, gate-pass-llm-pending', async () => {
  const r = await run([CLEAN])
  assert.equal(r.code, 0)
  assert.match(r.out, /gate-pass-llm-pending/)
})

test('clean repo + dummy verifier echoing public-ready → public-ready', async () => {
  const verifier = `printf 'VERDICT: public-ready\\n[info] looks good — none'`
  const r = await run([CLEAN, '--author', 'claude', '--verifier', verifier])
  assert.equal(r.code, 0)
  assert.match(r.out, /Verdict: \*\*public-ready\*\*/)
})

test('same-model verifier is capped at ready-with-notes', async () => {
  // verifier string contains "claude" (== author) → sameModel; '#' comments out the marker in shell
  const verifier = `printf 'VERDICT: public-ready\\n' # claude`
  const r = await run([CLEAN, '--author', 'claude', '--verifier', verifier])
  assert.match(r.out, /same model/)
  assert.match(r.out, /Verdict: \*\*ready-with-notes\*\*/)
})
