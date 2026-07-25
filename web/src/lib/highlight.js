import { refractor } from 'refractor'
import cmake from 'refractor/cmake'
import dart from 'refractor/dart'
import docker from 'refractor/docker'
import elixir from 'refractor/elixir'
import graphql from 'refractor/graphql'
import groovy from 'refractor/groovy'
import hcl from 'refractor/hcl'
import jsx from 'refractor/jsx'
import powershell from 'refractor/powershell'
import protobuf from 'refractor/protobuf'
import scala from 'refractor/scala'
import toml from 'refractor/toml'
import tsx from 'refractor/tsx'

// refractor's default entry already registers the common grammars (javascript,
// typescript, go, java, c, cpp, csharp, php, swift, sql, json, css, scss, sass,
// yaml, python, ruby, rust, kotlin, markdown, bash, perl, objectivec, makefile
// and more), so only the ones it leaves out are registered here.
for (const lang of [cmake, dart, docker, elixir, graphql, groovy, hcl, jsx, powershell, protobuf, scala, toml, tsx]) {
  refractor.register(lang)
}

// Files whose name carries no usable extension. Matched on the lowercased
// basename, then on the part before its first dot, so Dockerfile.dev and
// Makefile.local resolve as well.
const BY_NAME = {
  dockerfile: 'docker',
  containerfile: 'docker',
  makefile: 'makefile',
  cmakelists: 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
  brewfile: 'ruby',
  vagrantfile: 'ruby',
  jenkinsfile: 'groovy',
  gruntfile: 'javascript'
}

// Extensions whose name differs from the grammar's. An extension that already is
// the grammar name (go, java, css, sql, swift, ...) needs no entry, because
// languageFor falls back to trying the extension itself.
const BY_EXT = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  md: 'markdown',
  mdx: 'markdown',
  yml: 'yaml',
  sh: 'bash',
  zsh: 'bash',
  ksh: 'bash',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  kts: 'kotlin',
  h: 'c',
  hh: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  cs: 'csharp',
  jsonc: 'json',
  json5: 'json',
  pl: 'perl',
  pm: 'perl',
  m: 'objectivec',
  mm: 'objectivec',
  proto: 'protobuf',
  tf: 'hcl',
  tfvars: 'hcl',
  gql: 'graphql',
  ex: 'elixir',
  exs: 'elixir',
  sbt: 'scala',
  gradle: 'groovy',
  ps1: 'powershell',
  psm1: 'powershell',
  mk: 'makefile',
  cfg: 'ini',
  conf: 'ini',
  patch: 'diff'
}

// react-diff-view expects highlight() to return a node array (refractor v3 API);
// v4 returns a hast root, so unwrap it.
export const highlighter = {
  highlight: (text, language) => refractor.highlight(text, language).children
}

// Resolution order: whole filename, filename before its first dot, extension
// alias, then the extension as-is. Null means "render this file unhighlighted".
export function languageFor(path) {
  const basename = path.split('/').pop().toLowerCase()
  const named = BY_NAME[basename] ?? BY_NAME[basename.split('.')[0]]
  if (named) return refractor.registered(named) ? named : null
  const ext = basename.includes('.') ? basename.split('.').pop() : ''
  const language = BY_EXT[ext] ?? ext
  return language && refractor.registered(language) ? language : null
}
