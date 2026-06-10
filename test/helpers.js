import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Secret-shaped strings are ASSEMBLED at runtime from fragments so no literal
// secret pattern is ever committed to this repo (avoids GitHub push protection
// and keeps the repo passing its own gate).
const AWS = 'AKIA' + 'IOSFODNN7' + 'EXAMPLE'
const ANTHROPIC = 'sk-' + 'ant-' + 'abcdef0123456789ghijklmnop'

/** Build a dirty repo in a tmp dir: secret + tracked .env + no LICENSE. Returns {dir, cleanup}. */
export function makeDirtyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cv-dirty-'))
  writeFileSync(join(dir, 'README.md'), '# dirty\n')
  writeFileSync(join(dir, 'app.js'), `const key = "${ANTHROPIC}"\n`)
  writeFileSync(join(dir, '.env'), `AWS_KEY=${AWS}\n`)
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

export { tmpdir, mkdirSync }
