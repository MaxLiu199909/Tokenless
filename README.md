# Tokenless

Tokenless is a Claude Code plugin for capping noisy tool output before it enters model context.

It is not a generic summarizer. Tokenless keeps raw output as a local artifact and sends Claude a compact evidence packet with enough signal to continue the task.

The current wire format is `TOKENLESS-PACKET/0.1`.

## What it handles now

- Test logs: `npm test`, `pytest`, `go test`, `cargo test`
- Build and CI logs: `npm run build`, `docker build`, `kubectl logs`
- Diffs: `git diff`, `git log`
- Search and tree output: `rg`, `grep -R`, `find`, `tree`, `ls -R`
- Fallback compression for unexpectedly huge Bash output

Small bounded commands such as `rg -m 20`, `find ... | head`, `cat file | grep`, and `tree | head` are allowed through directly.

## How it works

```text
Claude wants to run a noisy command
  -> PreToolUse caps it before raw output enters context
  -> Claude reruns the Tokenless wrapper
  -> Tokenless executes the original command locally
  -> Tokenless saves raw stdout/stderr as an artifact
  -> Claude receives TOKENLESS-PACKET/0.1
```

The raw output is still available through `tokenless show` and `tokenless expand`. The shorter `acc` command remains as a compatibility alias.

## Quick demo

```bash
git clone https://github.com/MaxLiu199909/Tokenless.git
cd Tokenless
npm run eval:complex
```

Expected shape:

```text
TOKENLESS-COMPLEX-TEST/0.1
raw tokens: 16250
compressed tokens: ~1100
ratio: ~7%
pass: yes
```

To test the actual Claude Code hook path, run this inside Claude Code:

```bash
cd Tokenless && npm run test:complex
```

Expected behavior:

```text
PreToolUse caps the command
Claude reruns node .../bin/acc run --agent ...
Claude sees TOKENLESS-PACKET/0.1
```

## CLI

Use the local CLI directly:

```bash
node plugins/claude-code/bin/acc --help
```

For npm/global packaging, Tokenless exposes both commands:

```bash
tokenless --help
acc --help
```

`tokenless` is the preferred public command. `acc` remains available as a short compatibility alias and protocol-oriented command.

Common commands:

```bash
tokenless run --agent --data-dir /tmp/tokenless-test -- npm test
tokenless latest --data-dir ~/.acc
tokenless list --data-dir ~/.acc
tokenless show latest --data-dir ~/.acc
tokenless expand latest --around "Regression family 44" --data-dir ~/.acc
tokenless clean --data-dir ~/.acc --keep 100 --dry-run
```

## Claude Code hook setup

Install hooks globally for Claude Code:

```bash
npm run tokenless:install
```

This writes `~/.claude/settings.json`, merges with existing hooks, and creates a timestamped backup if the file already exists.

Check install status:

```bash
npm run tokenless:status
```

Preview before writing:

```bash
npm run tokenless:install:dry-run
```

Project-only install is still available:

```bash
npm run acc:install-hooks:project
```

Preview uninstall without writing:

```bash
npm run tokenless:uninstall:dry-run
```

Or print a copyable hook block:

```bash
npm run acc:print-hooks
```

The older `npm run acc:*` scripts are kept for compatibility.

For this local checkout, the hook scripts are:

- `plugins/claude-code/scripts/pre_tool_use.js`
- `plugins/claude-code/scripts/post_tool_use.js`
- `plugins/claude-code/scripts/post_tool_failure.js`

Tokenless currently uses a PreToolUse `deny` decision as a safety mechanism because some Claude Code builds do not reliably apply `updatedInput`. The message tells Claude to rerun the compacted command. This prevents raw noisy output from entering context.

## Artifact workflow

After a compressed command, inspect the latest artifact:

```bash
tokenless latest --data-dir ~/.acc
```

Expand only the relevant area:

```bash
tokenless expand latest --around "Cannot find module" --data-dir ~/.acc
```

This is the core Tokenless loop:

```text
compact first
act on evidence
expand only if needed
never paste the whole raw log back into context
```

## Evaluation

Run all synthetic and captured real cases:

```bash
npm run eval:all
```

Run the complex end-to-end test-log case:

```bash
npm run eval:complex
```

Run the local health check:

```bash
npm run doctor
```

## MVP verification checklist

Run these from the repo root:

```bash
cd Tokenless
npm run eval:complex
npm run doctor
npm run tokenless:status
npm run tokenless:install:dry-run
npm run tokenless:uninstall:dry-run
npm run tokenless:clean:dry-run
npm run eval:all
```

Expected results:

```text
eval:complex: pass: yes
doctor: all checks [ok]
tokenless:status: prints TOKENLESS-STATUS/0.1
tokenless:install:dry-run: prints TOKENLESS-INSTALL-HOOKS/0.1 and merged settings JSON
tokenless:uninstall:dry-run: prints TOKENLESS-UNINSTALL-HOOKS/0.1 and removed count
tokenless:clean:dry-run: prints TOKENLESS-CLEAN/0.1 with dry_run: yes
eval:all: all cases pass
```

To verify the actual Claude Code hook path, run inside Claude Code:

```bash
npm run test:complex
```

Expected behavior:

```text
PreToolUse caps the noisy command
Claude reruns node .../bin/acc run --agent ...
Claude receives TOKENLESS-PACKET/0.1
Failure families are visible
Raw artifact can be expanded with tokenless expand latest
```

## Cleanup

Artifacts are stored under the selected `--data-dir`, usually `~/.acc/artifacts`.

Preview cleanup:

```bash
npm run tokenless:clean:dry-run
```

Delete old artifacts manually:

```bash
tokenless clean --data-dir ~/.acc --older-than 7d
```

Keep only the newest 100:

```bash
tokenless clean --data-dir ~/.acc --keep 100
```

## Current limitations

- Claude Code Bash hook only.
- No cloud service and no LLM summarization.
- Reducers are deterministic and intentionally conservative.
- Legal, financial, medical, security, and exact-review tasks may require explicit artifact expansion.
- Small outputs can still expand slightly if forced through Tokenless; the classifier avoids common bounded commands, but the policy is not perfect.
