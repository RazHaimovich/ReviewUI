import { refractor } from 'refractor'
import jsx from 'refractor/jsx'
import tsx from 'refractor/tsx'

refractor.register(jsx)
refractor.register(tsx)

const BY_EXT = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  md: 'markdown',
  yml: 'yaml',
  sh: 'bash',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin'
}

// react-diff-view expects highlight() to return a node array (refractor v3 API);
// v4 returns a hast root, so unwrap it.
export const highlighter = {
  highlight: (text, language) => refractor.highlight(text, language).children
}

export function languageFor(path) {
  const ext = path.split('.').pop().toLowerCase()
  const language = BY_EXT[ext] ?? ext
  return refractor.registered(language) ? language : null
}
