// Pure helpers mapping react-diff-view change objects to comment anchors.
// Kept free of React/library imports so they can be unit-tested directly.

export function diffLine(change) {
  return (change.isInsert ? '+' : change.isDelete ? '-' : ' ') + change.content
}

// New-side line numbers when the selection exists there, old-side for deletions.
export function lineSide(changes) {
  const newLines = changes
    .map(c => (c.type === 'normal' ? c.newLineNumber : c.isInsert ? c.lineNumber : null))
    .filter(n => n != null)
  if (newLines.length > 0) {
    return { side: 'new', startLine: newLines[0], endLine: newLines[newLines.length - 1] }
  }
  const oldLines = changes.map(c => c.lineNumber)
  return { side: 'old', startLine: oldLines[0], endLine: oldLines[oldLines.length - 1] }
}

// Given a hunk's changes and a selected index range (in either order),
// return { side, startLine, endLine, snippet } where snippet includes a few
// lines of surrounding context.
// Display line number for a change on the given side (null when the line
// doesn't exist on that side, e.g. a deletion has no new-side number).
function lineNumberOn(change, side) {
  if (side === 'old') {
    if (change.type === 'normal') return change.oldLineNumber
    if (change.isDelete) return change.lineNumber
    return null
  }
  if (change.type === 'normal') return change.newLineNumber
  if (change.isInsert) return change.lineNumber
  return null
}

export function lineRange(changes, startIndex, endIndex) {
  const lo = Math.min(startIndex, endIndex)
  const hi = Math.max(startIndex, endIndex)
  const from = Math.max(0, lo - 2)
  const selected = changes.slice(lo, hi + 1)
  const context = changes.slice(from, hi + 3)
  const { side, startLine, endLine } = lineSide(selected)
  // `lines` carries a gutter number + content per context line for display;
  // selStart/selCount mark which of them are the selected (commented) lines.
  const lines = context.map(c => ({ num: lineNumberOn(c, side), content: diffLine(c) }))
  return {
    side,
    startLine,
    endLine,
    snippet: context.map(diffLine).join('\n'),
    lines,
    selStart: lo - from,
    selCount: hi - lo + 1
  }
}
