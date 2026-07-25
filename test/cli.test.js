import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PORT, parseFlags } from '../server/cli.js'

test('with no flags and no env, everything falls back to defaults', () => {
  const opts = parseFlags([], {})
  assert.deepEqual(opts, {
    help: false,
    version: false,
    port: DEFAULT_PORT,
    pinned: false,
    base: null,
    open: true
  })
})

test('a flag beats the matching environment variable', () => {
  const opts = parseFlags(['--port', '41200'], { REVIEWUI_PORT: '41300' })
  assert.equal(opts.port, 41200)
  assert.equal(opts.pinned, true)
})

test('either the flag or the environment variable pins the port', () => {
  assert.equal(parseFlags(['--port', '41200'], {}).pinned, true)
  assert.equal(parseFlags([], { REVIEWUI_PORT: '41200' }).pinned, true)
  assert.equal(parseFlags([], {}).pinned, false)
})

test('an empty environment variable reads as unset', () => {
  const opts = parseFlags([], { REVIEWUI_PORT: '', REVIEWUI_NO_OPEN: '' })
  assert.equal(opts.port, DEFAULT_PORT)
  assert.equal(opts.pinned, false)
  assert.equal(opts.open, true)
})

test('either --no-open or REVIEWUI_NO_OPEN suppresses the browser', () => {
  assert.equal(parseFlags(['--no-open'], {}).open, false)
  assert.equal(parseFlags([], { REVIEWUI_NO_OPEN: '1' }).open, false)
})

test('an unusable port is rejected rather than silently defaulted', () => {
  for (const bad of ['nope', '0', '70000', '41200.5']) {
    assert.throws(() => parseFlags(['--port', bad], {}), /--port must be a number/)
  }
})

test('an unknown flag throws so the caller can print usage', () => {
  assert.throws(() => parseFlags(['--nope'], {}))
})

test('--base is passed through, and -h and -v have short forms', () => {
  assert.equal(parseFlags(['--base', 'develop'], {}).base, 'develop')
  assert.equal(parseFlags(['-h'], {}).help, true)
  assert.equal(parseFlags(['-v'], {}).version, true)
})
