import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)

// Stands in for "the working tree" wherever a commit sha would go. Every code
// path branches on it before any ref assertion, so it never reaches git.
export const WORKTREE = 'worktree'

// Refuse ref-looking input that could be parsed as a git flag (e.g. --output=...).
export function assertRef(ref) {
  if (typeof ref !== 'string' || ref === '' || ref.startsWith('-')) {
    const err = new Error(`invalid ref: ${JSON.stringify(ref)}`)
    err.status = 400
    throw err
  }
  return ref
}

// Context lines come from the client and become a `-U` git argument, so bound
// them. Returns null for "not asked for", which leaves git's own default alone.
export function assertContext(context) {
  if (context === undefined || context === null || context === '') return null
  const n = Number(context)
  if (!Number.isInteger(n) || n < 0 || n > 99999) {
    const err = new Error(`invalid context: ${JSON.stringify(context)}`)
    err.status = 400
    throw err
  }
  return n
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

// Defined as what the tool can actually render: tracked changes, staged or not.
//
// ponytail: untracked files can't appear in `git diff` output at all, and the fix
// for that (`git add -N`) would write to the index of the repo under review,
// which this tool never does. They are surfaced as a count instead.
export async function isDirty(cwd) {
  return (await git(cwd, 'diff', 'HEAD', '--name-only')).trim() !== ''
}

// Paths git has never been told about. No diff can show them, so they are
// reported as a count instead of being silently absent. `-z` keeps paths
// unquoted, and gitignored files are already excluded by status.
export async function untrackedFiles(cwd) {
  const out = await git(cwd, 'status', '--porcelain', '--untracked-files=all', '-z')
  return out
    .split('\0')
    .filter(entry => entry.startsWith('?? '))
    .map(entry => entry.slice(3))
}

export async function mergeBase(cwd, base, head) {
  return (await git(cwd, 'merge-base', assertRef(base), assertRef(head))).trim()
}

export async function commits(cwd, base, head) {
  const mb = await mergeBase(cwd, base, head)
  const out = await git(cwd, 'log', '--reverse', '--format=%H%x1f%s%x1f%an%x1f%aI', `${mb}..${assertRef(head)}`)
  const list = out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [sha, subject, author, date] = line.split('\x1f')
      // Sliced rather than asked of git (`%h`): `%h` obeys core.abbrev, so a repo
      // configured for longer ids would show them. GitHub always shows 7.
      return { sha, shortSha: sha.slice(0, 7), subject, author, date }
    })

  // Uncommitted work is the newest entry, but only on the branch that is
  // actually checked out: comparing two other branches says nothing about the
  // working tree. The identifying fields are empty because there is no commit.
  const current = (await git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')).trim()
  if (head === current && (await isDirty(cwd))) {
    list.push({
      sha: WORKTREE,
      shortSha: null,
      subject: 'Uncommitted changes',
      author: null,
      date: null,
      worktree: true
    })
  }
  return list
}

// `-w` hides whitespace-only differences. It must reach the patch AND the
// numstat/name-status commands, or the file list's counts and its oversized
// threshold would describe a different diff from the one being rendered.
function wsArgs({ ws }) {
  return ws ? ['-w'] : []
}

// Pathspec that limits a diff to one file, or excludes a set of files.
// `--` protects paths that could otherwise be parsed as flags.
function pathArgs({ file, exclude }) {
  if (file) return ['--', file]
  if (exclude?.length) return ['--', '.', ...exclude.map(p => `:(exclude)${p}`)]
  return []
}

// Whether the default "Final result" view should span the working tree rather
// than stopping at the branch tip. True only when no specific commit was asked
// for, the compare branch is the checked-out one, and something is uncommitted.
// Short-circuits without touching git when a commit was named.
export async function finalIncludesWorktree(cwd, { head, commit }) {
  if (commit) return false
  const current = (await git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')).trim()
  return head === current && (await isDirty(cwd))
}

// What the working tree is diffed against. A two-dot range with no second ref
// means "...to the working tree", so cumulative spans the branch from its fork
// point and single shows only what isn't committed yet.
async function worktreeFrom(cwd, { base, head, mode }) {
  return mode === 'cumulative' ? await mergeBase(cwd, base, head) : 'HEAD'
}

export async function diff(cwd, opts) {
  const { base, head, commit, mode } = opts
  const paths = pathArgs(opts)
  const ws = wsArgs(opts)
  // Context widens the patch only. It cannot change add/delete counts, so the
  // stat commands deliberately do not take it.
  const context = assertContext(opts.context)
  const ctx = context === null ? [] : [`-U${context}`]
  // `-M` so the patch's rename detection matches the file list's, whatever the
  // user's diff.renames config is.
  if (commit === WORKTREE) {
    return git(cwd, 'diff', '-M', ...ws, ...ctx, await worktreeFrom(cwd, opts), ...paths)
  }
  if (commit) {
    assertRef(commit)
    if (mode === 'cumulative') {
      const mb = await mergeBase(cwd, base, head)
      return git(cwd, 'diff', '-M', ...ws, ...ctx, `${mb}..${commit}`, ...paths)
    }
    return git(cwd, 'show', '-M', ...ws, ...ctx, '--format=', '--patch', commit, ...paths)
  }
  return git(cwd, 'diff', '-M', ...ws, ...ctx, `${assertRef(base)}...${assertRef(head)}`, ...paths)
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
async function statArgs(cwd, opts, which) {
  const { base, head, commit, mode } = opts
  const ws = wsArgs(opts)
  if (commit === WORKTREE) {
    return ['diff', which, '-M', '-z', ...ws, await worktreeFrom(cwd, opts)]
  }
  if (commit) {
    assertRef(commit)
    if (mode === 'cumulative') {
      const mb = await mergeBase(cwd, base, head)
      return ['diff', which, '-M', '-z', ...ws, `${mb}..${commit}`]
    }
    // `git show --numstat --no-patch` suppresses numstat; diff-tree is the right tool.
    return ['diff-tree', '--no-commit-id', '-r', '-M', '-z', ...ws, which, commit]
  }
  return ['diff', which, '-M', '-z', ...ws, `${assertRef(base)}...${assertRef(head)}`]
}

// Per-file summary: path, add/del counts, binary flag, and change type.
export async function diffStat(cwd, opts) {
  const nums = parseNumstatZ(await git(cwd, ...(await statArgs(cwd, opts, '--numstat'))))
  const status = parseNameStatusZ(await git(cwd, ...(await statArgs(cwd, opts, '--name-status'))))
  return nums.map(f => ({ ...f, type: status.get(f.path) ?? 'modify' }))
}
