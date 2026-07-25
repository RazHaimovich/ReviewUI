import test from 'node:test'
import assert from 'node:assert/strict'
import { languageFor } from '../web/src/lib/highlight.js'

test('extensions that are already grammar names keep working', () => {
  assert.equal(languageFor('main.go'), 'go')
  assert.equal(languageFor('Main.java'), 'java')
  assert.equal(languageFor('web/src/index.css'), 'css')
  assert.equal(languageFor('schema.sql'), 'sql')
})

test('extension aliases resolve to the right grammar', () => {
  assert.equal(languageFor('server/index.js'), 'javascript')
  assert.equal(languageFor('vec.h'), 'c')
  assert.equal(languageFor('vec.hpp'), 'cpp')
  assert.equal(languageFor('Program.cs'), 'csharp')
  assert.equal(languageFor('main.tf'), 'hcl')
  assert.equal(languageFor('app.ps1'), 'powershell')
  assert.equal(languageFor('mix.exs'), 'elixir')
  assert.equal(languageFor('api.proto'), 'protobuf')
  assert.equal(languageFor('tsconfig.jsonc'), 'json')
})

test('grammars refractor does not register by default are available', () => {
  assert.equal(languageFor('Cargo.toml'), 'toml')
  assert.equal(languageFor('schema.graphql'), 'graphql')
  assert.equal(languageFor('main.dart'), 'dart')
  assert.equal(languageFor('Build.scala'), 'scala')
})

test('files with no usable extension resolve by name', () => {
  assert.equal(languageFor('Dockerfile'), 'docker')
  assert.equal(languageFor('Makefile'), 'makefile')
  assert.equal(languageFor('deploy/Gemfile'), 'ruby')
  assert.equal(languageFor('CMakeLists.txt'), 'cmake')
})

test('a name-matched file still resolves with a suffix after the first dot', () => {
  assert.equal(languageFor('Dockerfile.dev'), 'docker')
  assert.equal(languageFor('Makefile.local'), 'makefile')
})

test('unknown and extensionless files return null rather than throwing', () => {
  assert.equal(languageFor('notes.zzz'), null)
  assert.equal(languageFor('LICENSE'), null)
  assert.equal(languageFor('.gitignore'), null)
  assert.equal(languageFor('data.bin'), null)
})
