import test from 'node:test'
import assert from 'node:assert/strict'
import { filterEntries, isFiltering, NO_FILTER } from '../web/src/lib/fileFilter.js'

const entries = [
  { path: 'server/git.js', comments: 0, reviewed: false },
  { path: 'server/routes/diff.js', comments: 2, reviewed: true },
  { path: 'web/src/components/App.jsx', comments: 1, reviewed: false },
  { path: 'README.md', comments: 0, reviewed: true }
]

const paths = list => list.map(e => e.path)

test('no filter returns the same list untouched', () => {
  assert.equal(filterEntries(entries, NO_FILTER), entries)
  assert.equal(filterEntries(entries), entries)
})

test('the query matches anywhere in the path, case-insensitively', () => {
  assert.deepEqual(paths(filterEntries(entries, { query: 'server' })), ['server/git.js', 'server/routes/diff.js'])
  assert.deepEqual(paths(filterEntries(entries, { query: 'APP' })), ['web/src/components/App.jsx'])
  assert.deepEqual(paths(filterEntries(entries, { query: '  git  ' })), ['server/git.js'])
})

test('hideViewed drops files already marked viewed', () => {
  assert.deepEqual(paths(filterEntries(entries, { hideViewed: true })), ['server/git.js', 'web/src/components/App.jsx'])
})

test('onlyCommented keeps just the files carrying comments', () => {
  assert.deepEqual(paths(filterEntries(entries, { onlyCommented: true })), [
    'server/routes/diff.js',
    'web/src/components/App.jsx'
  ])
})

test('criteria compose', () => {
  const filtered = filterEntries(entries, { query: 'js', hideViewed: true, onlyCommented: true })
  assert.deepEqual(paths(filtered), ['web/src/components/App.jsx'])
})

test('a query that matches nothing gives an empty list, not everything', () => {
  assert.deepEqual(filterEntries(entries, { query: 'nowhere' }), [])
})

test('isFiltering ignores a whitespace-only query', () => {
  assert.equal(isFiltering(NO_FILTER), false)
  assert.equal(isFiltering({ query: '   ' }), false)
  assert.equal(isFiltering({ query: 'a' }), true)
  assert.equal(isFiltering({ hideViewed: true }), true)
  assert.equal(isFiltering({ onlyCommented: true }), true)
})
