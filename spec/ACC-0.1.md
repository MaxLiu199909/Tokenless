# ACC-0.1 Specification

ACC is a local, deterministic context compression pipeline for Claude Code.

- Input: tool output from noisy Bash commands
- Process: classify -> select reducer -> generate compact evidence packet -> save raw artifact
- Output: short `ACC-COMPACTED/0.1` block
- Traceability: full raw output stored under `${CLAUDE_PLUGIN_DATA}/artifacts/<artifact_id>/`
- CLI: `acc run` executes commands, `acc compact --stdin` compresses existing text, `acc show` and `acc expand` recover raw evidence.

Supported command classes in v0.1:
- npm/pnpm/yarn test
- pytest
- build and CI commands: npm/pnpm/yarn build, lint, typecheck, install, mvn, gradle, docker build, kubectl logs/describe, Vercel, Netlify
- git diff / git log
- rg / grep -R
- find / tree / ls -R
- cat (large)
- docker logs
