# Changelog

## v0.1.0-mvp

Initial Claude Code MVP for Tokenless context compression.

### Added

- Claude Code plugin scaffold under `plugins/claude-code`.
- Bash PreToolUse hook that caps noisy commands before raw output enters model context.
- Bash PostToolUse and PostToolUseFailure fallback hooks.
- Local `acc` CLI with:
  - `run --agent`
  - `compact`
  - `doctor`
  - `status`
  - `list`
  - `latest`
  - `show`
  - `expand`
  - `print-hooks`
  - `install-hooks --user`
  - `install-hooks --project`
  - `uninstall-hooks --user`
  - `uninstall-hooks --project`
  - `clean`
- Raw artifact storage under the selected `--data-dir`.
- `latest` artifact alias for `show` and `expand`.
- Deterministic reducers for:
  - test logs
  - build and CI logs
  - git diffs
  - search output
  - file trees
  - generic Bash output
- Test-log failure triage with:
  - summary lines
  - failure families
  - first 25 failure index
  - representative failure details
  - relevant file:line hints
- Complex end-to-end test-log eval.
- README quickstart, hook setup, artifact workflow, cleanup, and limitations.

### Verified

- `npm run eval:complex`
- `npm run doctor`
- `npm run tokenless:status`
- `npm run tokenless:install:dry-run`
- `npm run tokenless:uninstall:dry-run`
- `npm run tokenless:clean:dry-run`
- `npm run eval:all`
- Claude Code hook path with `npm run test:complex`

### Known limitations

- Claude Code Bash hook only.
- PreToolUse currently uses `deny` to force rerun through ACC because `updatedInput` behavior can be unreliable across Claude Code builds.
- Reducers are deterministic and intentionally conservative.
- Exact-review and high-stakes domains may require explicit artifact expansion.
