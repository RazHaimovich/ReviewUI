import test from 'node:test'
import assert from 'node:assert/strict'
import { lineRange } from '../web/src/lib/lineRange.js'

// Mimics the shape react-diff-view produces for a hunk's changes.
const changes = [
  { type: 'normal', content: 'context above', oldLineNumber: 40, newLineNumber: 40 },
  { type: 'insert', isInsert: true, content: 'added one', lineNumber: 41 },
  { type: 'insert', isInsert: true, content: 'added two', lineNumber: 42 },
  { type: 'delete', isDelete: true, content: 'removed', lineNumber: 43 }
]

test('single inserted line maps to the new side', () => {
  const r = lineRange(changes, 1, 1)
  assert.equal(r.side, 'new')
  assert.equal(r.startLine, 41)
  assert.equal(r.endLine, 41)
  assert.match(r.snippet, /\+added one/)
})

test('multi-line range covers start..end and captures each selected line', () => {
  const r = lineRange(changes, 1, 2)
  assert.equal(r.side, 'new')
  assert.equal(r.startLine, 41)
  assert.equal(r.endLine, 42)
  assert.match(r.snippet, /\+added one/)
  assert.match(r.snippet, /\+added two/)
})

test('reversed indices are normalized', () => {
  const r = lineRange(changes, 2, 1)
  assert.equal(r.startLine, 41)
  assert.equal(r.endLine, 42)
})

test('delete-only selection uses the old side', () => {
  const r = lineRange(changes, 3, 3)
  assert.equal(r.side, 'old')
  assert.equal(r.startLine, 43)
  assert.match(r.snippet, /-removed/)
})
