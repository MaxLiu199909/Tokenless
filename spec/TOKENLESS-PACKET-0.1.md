# Tokenless Packet 0.1 Specification

Tokenless is a local, deterministic context compression pipeline for coding agents.

- Input: tool output from noisy Bash commands
- Process: classify -> select reducer -> generate compact evidence packet -> save raw artifact
- Output: short `TOKENLESS-PACKET/0.1` block
- Traceability: full raw output stored under `${CLAUDE_PLUGIN_DATA}/artifacts/<artifact_id>/`
- CLI: `tokenless run` executes commands, `tokenless compact --stdin` compresses existing text, `tokenless show` and `tokenless expand` recover raw evidence. The shorter `acc` command remains available as a compatibility alias.

Supported command classes in v0.1:
- npm/pnpm/yarn test
- pytest
- build and CI commands: npm/pnpm/yarn build, lint, typecheck, install, mvn, gradle, docker build, kubectl logs/describe, Vercel, Netlify
- git diff / git log
- rg / grep -R
- find / tree / ls -R
- cat (large)
- docker logs
