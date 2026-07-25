import test from 'node:test'
import assert from 'node:assert/strict'
import { isTypingTarget, nextPath } from '../web/src/lib/keyNav.js'

const paths = ['a.js', 'b.js', 'c.js']

test('moves forward and back through the list', () => {
  assert.equal(nextPath(paths, 'a.js', 1), 'b.js')
  assert.equal(nextPath(paths, 'b.js', 1), 'c.js')
  assert.equal(nextPath(paths, 'c.js', -1), 'b.js')
})

test('stops at both ends instead of wrapping', () => {
  assert.equal(nextPath(paths, 'c.js', 1), 'c.js')
  assert.equal(nextPath(paths, 'a.js', -1), 'a.js')
})

test('with nothing focused it enters from the nearest end', () => {
  assert.equal(nextPath(paths, null, 1), 'a.js')
  assert.equal(nextPath(paths, null, -1), 'c.js')
})

test('a focus that has been filtered out of the list enters from the end too', () => {
  assert.equal(nextPath(paths, 'gone.js', 1), 'a.js')
})

test('an empty list has nowhere to go', () => {
  assert.equal(nextPath([], null, 1), null)
  assert.equal(nextPath([], 'a.js', -1), null)
})

test('typing targets are recognized so shortcuts stay out of the way', () => {
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true)
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true)
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true)
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true)
  assert.equal(isTypingTarget({ tagName: 'DIV' }), false)
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false)
  assert.equal(isTypingTarget(null), false)
})
