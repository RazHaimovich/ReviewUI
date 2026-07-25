# ReviewUI

[![npm version](https://img.shields.io/npm/v/reviewui)](https://www.npmjs.com/package/reviewui)
[![license](https://img.shields.io/npm/l/reviewui)](./LICENSE)

**GitHub:** https://github.com/RazHaimovich/ReviewUI

Review any git branch like a GitHub pull request, locally, and turn your review
comments into a single prompt for your coding agent (Claude Code, Codex, or
anything else that takes a prompt).

```sh
cd your-repo
npx reviewui
```

Opens a review UI at http://localhost:41096 comparing your current branch
against `main`/`master`. Browse the diff (final result, commit by commit, or the
work you haven't committed yet), leave comments on lines or ranges, then click
**Generate Prompt** - the assembled feedback is copied to your clipboard and
printed to the terminal, ready to paste into Claude Code, Codex, or any other
agent.

Requires Node 18+ and `git` on your PATH. Nothing to install and nothing to
configure.

## What you get

- **Review work you haven't committed yet.** Uncommitted changes show up as the
  newest entry in the commit bar, with no id, and the default view includes them.
  Nothing reloads on its own: **Refresh** re-reads the repo when you ask.
- Side-by-side or unified diff, with only the words that changed highlighted.
- Syntax highlighting that covers extensionless files like `Dockerfile` too.
- Pick any base and compare branch, not just the default guess.
- Review the whole branch at once or step through it commit by commit.
- Widen the context around a file's changes from 3 lines to 20 to the whole file.
- Hide whitespace-only changes when a branch carries a formatting pass.
- Filter the file tree by name, hide files you've marked viewed, or show only the
  ones you commented on.
- Tag each comment must-fix, question or nit, so your agent knows what blocks.
- Keyboard navigation: `j`/`k` between files, `v` to mark viewed, `/` to filter,
  `g` to generate, `?` for the full list.
- Line and range comments, plus an overall summary, bundled into one prompt.
- Light and dark themes.

## Options

```sh
npx reviewui --help
```

| Flag            | Effect                                                             |
| --------------- | ------------------------------------------------------------------ |
| `--port <n>`    | Pin an exact port. Fails if taken; unset, it auto-increments.      |
| `--base <ref>`  | Branch, tag or commit to compare against. Default `main`/`master`. |
| `--no-open`     | Do not open a browser.                                             |
| `-h, --help`    | Show usage.                                                        |
| `-v, --version` | Show the version.                                                  |

`REVIEWUI_PORT` and `REVIEWUI_NO_OPEN` do the same as `--port` and `--no-open`.
A flag wins over the matching environment variable, and a `--base` that does not
resolve fails at startup rather than in the browser.

The server binds to `127.0.0.1` only, keeps comments in memory for the session,
and never writes into the repository it is reviewing.

## Development

```sh
npm install
npm run build        # build the web UI into web/dist
npm test             # HTTP API tests against a fixture git repo
node server/index.js # run from inside any git repo
npm run dev:web      # Vite dev server (proxies /api to :41096)
```
