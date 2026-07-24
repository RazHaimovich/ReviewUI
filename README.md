# ReviewUI

[![npm version](https://img.shields.io/npm/v/reviewui)](https://www.npmjs.com/package/reviewui)
[![license](https://img.shields.io/npm/l/reviewui)](./LICENSE)

**GitHub:** https://github.com/RazHaimovich/ReviewUI

Review any git branch like a GitHub pull request, locally, and turn your review
comments into a single prompt for Claude Code.

```sh
cd your-repo
npx reviewui
```

Opens a review UI at http://localhost:41096 comparing your current branch
against `main`/`master`. Browse the diff (final result or commit by commit),
leave comments on lines or ranges, then click **Generate Prompt** - the
assembled feedback is copied to your clipboard and printed to the terminal,
ready to paste into Claude Code.

## Development

```sh
npm install
npm run build        # build the web UI into web/dist
npm test             # HTTP API tests against a fixture git repo
node server/index.js # run from inside any git repo
npm run dev:web      # Vite dev server (proxies /api to :41096)
```
