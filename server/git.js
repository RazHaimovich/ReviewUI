import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)

// Refuse ref-looking input that could be parsed as a git flag (e.g. --output=...).
export function assertRef(ref) {
  if (typeof ref !== 'string' || ref === '' || ref.startsWith('-')) {
    const err = new Error(`invalid ref: ${JSON.stringify(ref)}`)
    err.status = 400
    throw err
  }
  return ref
}

export async function git(cwd, ...args) {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

export async function isGitRepo(cwd) {
  try {
    await git(cwd, 'rev-parse', '--is-inside-work-tree')
    return true
  } catch {
    return false
  }
}

export async function repoInfo(cwd) {
  const toplevel = (await git(cwd, 'rev-parse', '--show-toplevel')).trim()
  const branches = (await git(cwd, 'branch', '--format=%(refname:short)')).split('\n').filter(Boolean)
  const current = (await git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')).trim()
  const defaultBase = ['main', 'master'].find(b => branches.includes(b)) ?? null
  return { name: path.basename(toplevel), branches, current, defaultBase }
}

export async function mergeBase(cwd, base, head) {
  return (await git(cwd, 'merge-base', assertRef(base), assertRef(head))).trim()
}

export async function commits(cwd, base, head) {
  const mb = await mergeBase(cwd, base, head)
  const out = await git(cwd, 'log', '--reverse', '--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI', `${mb}..${assertRef(head)}`)
  return out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [sha, shortSha, subject, author, date] = line.split('\x1f')
      return { sha, shortSha, subject, author, date }
    })
}

export async function diff(cwd, { base, head, commit, mode }) {
  if (commit) {
    assertRef(commit)
    if (mode === 'cumulative') {
      const mb = await mergeBase(cwd, base, head)
      return git(cwd, 'diff', `${mb}..${commit}`)
    }
    return git(cwd, 'show', '--format=', '--patch', commit)
  }
  return git(cwd, 'diff', `${assertRef(base)}...${assertRef(head)}`)
}
