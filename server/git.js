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

// Pathspec that limits a diff to one file, or excludes a set of files.
// `--` protects paths that could otherwise be parsed as flags.
function pathArgs({ file, exclude }) {
  if (file) return ['--', file]
  if (exclude?.length) return ['--', '.', ...exclude.map(p => `:(exclude)${p}`)]
  return []
}

export async function diff(cwd, opts) {
  const { base, head, commit, mode } = opts
  const paths = pathArgs(opts)
  // `-M` so the patch's rename detection matches the file list's, whatever the
  // user's diff.renames config is.
  if (commit) {
    assertRef(commit)
    if (mode === 'cumulative') {
      const mb = await mergeBase(cwd, base, head)
      return git(cwd, 'diff', '-M', `${mb}..${commit}`, ...paths)
    }
    return git(cwd, 'show', '-M', '--format=', '--patch', commit, ...paths)
  }
  return git(cwd, 'diff', '-M', `${assertRef(base)}...${assertRef(head)}`, ...paths)
}

const STATUS_TYPE = { A: 'add', D: 'delete', M: 'modify', T: 'modify' }

// Parse `--numstat -z`: each record is `adds\tdels\t<path>` NUL, and for renames
// `adds\tdels\t` NUL `<old>` NUL `<new>` NUL. `-z` disables path quoting so the
// paths match gitdiff-parser's newPath on the client (renames, non-ASCII, spaces).
function parseNumstatZ(out) {
  const parts = out.split('\0')
  const files = []
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].match(/^(\d+|-)\t(\d+|-)\t(.*)$/s)
    if (!m) continue
    const [, a, d, rest] = m
    const path = rest === '' ? parts[(i += 2)] : rest // rename: skip old, take new
    const binary = a === '-'
    files.push({ path, adds: binary ? 0 : Number(a), dels: binary ? 0 : Number(d), binary })
  }
  return files
}

// Parse `--name-status -z` into Map(path -> type). Renames/copies key on the dst.
function parseNameStatusZ(out) {
  const parts = out.split('\0')
  const map = new Map()
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i]
    if (!status) continue
    if (status[0] === 'R' || status[0] === 'C') {
      map.set(parts[i + 2], 'rename')
      i += 2
    } else {
      map.set(parts[i + 1], STATUS_TYPE[status[0]] ?? 'modify')
      i += 1
    }
  }
  return map
}

// Argument list (no patch) for `which` = '--numstat' | '--name-status'.
// `-M` enables rename detection (diff-tree, unlike `git diff`, leaves it off).
async function statArgs(cwd, { base, head, commit, mode }, which) {
  if (commit) {
    assertRef(commit)
    if (mode === 'cumulative') {
      const mb = await mergeBase(cwd, base, head)
      return ['diff', which, '-M', '-z', `${mb}..${commit}`]
    }
    // `git show --numstat --no-patch` suppresses numstat; diff-tree is the right tool.
    return ['diff-tree', '--no-commit-id', '-r', '-M', '-z', which, commit]
  }
  return ['diff', which, '-M', '-z', `${assertRef(base)}...${assertRef(head)}`]
}

// Per-file summary: path, add/del counts, binary flag, and change type.
export async function diffStat(cwd, opts) {
  const nums = parseNumstatZ(await git(cwd, ...(await statArgs(cwd, opts, '--numstat'))))
  const status = parseNameStatusZ(await git(cwd, ...(await statArgs(cwd, opts, '--name-status'))))
  return nums.map(f => ({ ...f, type: status.get(f.path) ?? 'modify' }))
}
