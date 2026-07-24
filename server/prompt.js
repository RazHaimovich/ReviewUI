export function buildPrompt({ repoName, base, head, comments, summary }) {
  const included = comments.filter(c => c.included !== false)
  const lines = [
    '# Code Review Feedback',
    '',
    `Review of \`${head}\` vs \`${base}\` in ${repoName}. Address each comment below.`,
    ''
  ]

  included.forEach((c, i) => {
    if (c.scope === 'file') {
      lines.push(`## ${i + 1}. ${c.filePath} (whole file)`, '', `**Comment:** ${c.body}`, '')
      return
    }
    const range = c.endLine && c.endLine !== c.startLine ? `${c.startLine}-${c.endLine}` : `${c.startLine}`
    const context = c.commitSha
      ? ` (commented on commit ${c.commitSha.slice(0, 7)}${c.mode === 'cumulative' ? ', cumulative view' : ''})`
      : ''
    lines.push(
      `## ${i + 1}. ${c.filePath}:${range}${context}`,
      '',
      '```',
      c.snippet,
      '```',
      '',
      `**Comment:** ${c.body}`,
      ''
    )
  })

  if (summary?.trim()) lines.push('## Overall', '', summary.trim(), '')

  lines.push(
    'Please address all comments above. Line numbers may have shifted for comments made on intermediate commits - locate the referenced snippet by its content if needed.'
  )
  return lines.join('\n')
}
