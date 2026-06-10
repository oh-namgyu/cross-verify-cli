/** Render the combined result as VERIFY-REPORT markdown. */
export function toMarkdown(result) {
  const { project, mode, author, verifier, sameModel, verdict, gate, llm } = result
  const lines = [
    '# VERIFY-REPORT',
    '',
    `- Verdict: **${verdict}**`,
    `- Mode: ${mode}`,
    `- Author model: ${author}  →  Verifier: ${verifier}${sameModel ? '  ⚠️ same model (independence not guaranteed)' : ''}`,
    '',
    '## Deterministic gate',
    `- README: ${gate.checks.readme} · LICENSE: ${gate.checks.license} · secrets: ${gate.checks.secrets} · .env tracked: ${gate.checks.env_tracked} · files scanned: ${gate.checks.files_scanned}`,
  ]
  if (gate.blockers.length) {
    lines.push('', '### ⛔ Blockers (verdict forced to `blocked`)')
    for (const b of gate.blockers) lines.push(`- [${b.rule}] ${b.message}`)
  }
  const piiInfo = gate.findings.filter((f) => f.rule === 'pii')
  if (piiInfo.length) {
    lines.push('', '### PII / sensitive signals')
    for (const f of piiInfo) lines.push(`- [${f.severity}] ${f.label} — ${f.file}:${f.line}`)
  }

  lines.push('', '## Independent verifier findings')
  if (!llm) {
    lines.push('- (verifier not run — gate-only mode or verifier error)')
  } else if (llm.error) {
    lines.push(`- ⚠️ verifier error: ${llm.error}`)
  } else if (!llm.findings.length) {
    lines.push('- (no findings reported)')
  } else {
    for (const f of llm.findings) lines.push(`- [${f.severity}] ${f.title}${f.fix ? ` — ${f.fix}` : ''}`)
  }
  return lines.join('\n') + '\n'
}

export function toJson(result) {
  return JSON.stringify(
    {
      project: result.project,
      mode: result.mode,
      author: result.author,
      verifier: result.verifier,
      sameModel: result.sameModel,
      verdict: result.verdict,
      gate: { checks: result.gate.checks, blockers: result.gate.blockers, findings: result.gate.findings },
      verifier_findings: result.llm?.findings ?? [],
      verifier_error: result.llm?.error ?? null,
    },
    null,
    2
  )
}
