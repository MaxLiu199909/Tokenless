---
name: context-compression
description: Use Tokenless to compress noisy tool outputs before they enter context. Prefer this skill when running tests, reading diffs, searching large repos, or inspecting logs.
---

# Tokenless Context Compression

When working in this project, avoid feeding noisy raw outputs directly into context.

The hook automatically routes high-noise Bash commands through Tokenless.

For manual local development in this repository, use `./plugins/claude-code/bin/acc` or the packaged `tokenless` alias:

```bash
./plugins/claude-code/bin/acc run --agent --data-dir /tmp/acc-dev -- npm test
```

High-noise commands include:
- npm test, pnpm test, yarn test
- pytest
- npm/pnpm/yarn build, lint, typecheck, install
- go test, cargo test, mvn test/verify/package, gradle build/test
- git diff, git log
- rg, grep -R
- find, tree, ls -R
- docker logs/build, kubectl logs/describe, Vercel/Netlify CLI logs

When you see a `TOKENLESS-PACKET` block:
1. Treat it as a compressed evidence packet.
2. Use the key failures, relevant files, line numbers, and raw artifact pointer.
3. Do not ask for the full raw output unless needed.
4. If needed, use the full raw artifact command shown in the `Raw artifact:` line.

Never assume omitted sections are irrelevant if the task requires exact full-text review. For legal, financial, security-critical, or exact patch review tasks, inspect raw artifacts when necessary.
