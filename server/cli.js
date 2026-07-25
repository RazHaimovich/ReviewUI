import { parseArgs } from 'node:util'

export const DEFAULT_PORT = 41096

export const USAGE = `reviewui - review any git branch like a GitHub PR, locally.

Usage: reviewui [options]

Options:
  --port <n>     Port to bind. Pins it: fails if taken instead of moving on.
                 Default ${DEFAULT_PORT}, auto-incrementing while unpinned.
  --base <ref>   Branch, tag or commit to compare against.
                 Default: main, else master.
  --no-open      Do not open a browser.
  -h, --help     Show this help.
  -v, --version  Show the version.

REVIEWUI_PORT and REVIEWUI_NO_OPEN do the same as --port and --no-open.
A flag wins over the matching environment variable.`

// Resolve options from argv and env: a flag beats its environment variable,
// which beats the default. Throws on an unknown flag or an unusable port, so
// the caller can print usage and exit rather than starting up misconfigured.
export function parseFlags(argv = [], env = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string' },
      base: { type: 'string' },
      'no-open': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' }
    },
    allowPositionals: false
  })

  // `||` rather than `??` so an empty environment variable reads as unset,
  // which is how the port has always behaved.
  const rawPort = values.port || env.REVIEWUI_PORT || undefined
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port must be a number between 1 and 65535, got ${JSON.stringify(rawPort)}`)
  }

  return {
    help: Boolean(values.help),
    version: Boolean(values.version),
    port,
    // Pinned means "bind this exact port or fail", so it can never drift away
    // from a dev proxy or from a URL the user already has open.
    pinned: rawPort !== undefined,
    base: values.base || null,
    open: !(values['no-open'] || env.REVIEWUI_NO_OPEN)
  }
}
