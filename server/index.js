#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createApp } from './app.js'
import { parseFlags, USAGE } from './cli.js'
import { assertRef, git, isGitRepo } from './git.js'

let opts
try {
  opts = parseFlags(process.argv.slice(2), process.env)
} catch (err) {
  console.error(`reviewui: ${err.message}\n\n${USAGE}`)
  process.exit(1)
}

if (opts.help) {
  console.log(USAGE)
  process.exit(0)
}

if (opts.version) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  console.log(version)
  process.exit(0)
}

// A pinned port (--port or REVIEWUI_PORT, kept in sync with the Vite dev proxy)
// is bound or nothing, so the port never drifts away from the proxy. Unpinned -
// the npx default - auto-increments upward.
const MAX_ATTEMPTS = opts.pinned ? 0 : 20
const cwd = process.cwd()

if (!(await isGitRepo(cwd))) {
  console.error(`reviewui: not a git repository: ${cwd}`)
  process.exit(1)
}

// Run all git commands from the repo root so file lists (whole-repo, root-relative)
// and per-file diffs use the same pathspecs even when launched in a subdirectory.
const repoDir = (await git(cwd, 'rev-parse', '--show-toplevel')).trim()

// Resolve --base before binding, so a typo fails here with a clear message
// instead of surfacing later as a diff error in the browser.
if (opts.base) {
  try {
    await git(repoDir, 'rev-parse', '--verify', '--quiet', `${assertRef(opts.base)}^{commit}`)
  } catch {
    console.error(`reviewui: --base is not a branch, tag or commit in this repo: ${opts.base}`)
    process.exit(1)
  }
}

// Try the chosen port, then the next ports upward until one is free.
function listen(app, port, attemptsLeft) {
  const server = app.listen(port, '127.0.0.1')
  server.on('listening', () => onListening(port))
  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(app, port + 1, attemptsLeft - 1)
    } else if (err.code === 'EADDRINUSE' && opts.pinned) {
      console.error(`reviewui: port ${opts.port} is in use - free it or pick another with --port.`)
      process.exit(1)
    } else if (err.code === 'EADDRINUSE') {
      console.error(
        `reviewui: no free port in ${opts.port}-${opts.port + MAX_ATTEMPTS} - is ReviewUI already running everywhere?`
      )
      process.exit(1)
    } else {
      throw err
    }
  })
}

function onListening(port) {
  const url = `http://localhost:${port}`
  console.log(`\n  ReviewUI running at ${url}  (Ctrl+C to quit)\n`)
  if (!opts.open) return
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]]
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
}

listen(createApp(repoDir, { defaultBase: opts.base }), opts.port, MAX_ATTEMPTS)
