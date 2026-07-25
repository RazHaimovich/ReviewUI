import test from 'node:test'
import assert from 'node:assert/strict'
import { contextLabel, nextContext } from '../web/src/lib/diffContext.js'

test('the context cycle runs default, wider, whole file, then wraps', () => {
  assert.equal(nextContext(null), 20)
  assert.equal(nextContext(20), 99999)
  assert.equal(nextContext(99999), null)
})

test('an unrecognized context restarts the cycle instead of getting stuck', () => {
  assert.equal(nextContext(7), null)
})

test('labels read as the number of lines, or "all" for the whole file', () => {
  assert.equal(contextLabel(null), '3')
  assert.equal(contextLabel(20), '20')
  assert.equal(contextLabel(99999), 'all')
})
