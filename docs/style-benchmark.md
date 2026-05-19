# Tokenless output style benchmark

Tokenless style controls Claude Code response shape. This benchmark isolates
response-token behavior from read/edit/write packet compression by using prompts
that do not trigger Tokenless file reducers.

## Public modes

| Mode | Purpose | Internal basis |
| --- | --- | --- |
| `chat` | Shortest readable natural-language output | Previous `silent` experiment |
| `coding` | Dense structured output for coding workflows | Previous `dense2` D2 experiment |
| `off` | Disable style injection | Baseline |

Legacy experiment names such as `lean`, `silent`, `wire`, `dense`, and `dense2`
are accepted as compatibility aliases, but the public surface is intentionally
limited to `chat`, `coding`, and `off`.

## Result summary

Six-prompt Claude Code API-body run:

| Public mode | Response tokens | Responses | Avg / response | Change vs off |
| --- | ---: | ---: | ---: | ---: |
| `off` | 2,168 | 6 | 361 | baseline |
| `chat` | 1,189 | 6 | 198 | -45.2% |
| `coding` | 1,085 | 6 | 181 | -50.0% |

Decision:

- Use `chat` as the default because it remains human-readable while cutting
  response tokens by 45.2% versus `off`.
- Use `coding` for Claude Code coding workflows where structured dense output is
  acceptable. It is the current lowest-token mode and beats `chat` by 8.7%.

## Clean natural-conversation run

This run uses six ordinary non-coding prompts: explain agents, give practical
criteria for product managers, walk through a user-feedback example, name
specific risks, propose a first-week trial, and summarize the case for a boss.

No file tools or Tokenless packet reducers were involved.

| Mode | Request tokens | Response tokens | All tokens | Requests | Responses |
| --- | ---: | ---: | ---: | ---: | ---: |
| `off` | 142,748 | 7,223 | 149,971 | 7 | 7 |
| `chat` | 136,926 | 1,442 | 138,368 | 7 | 7 |

Result:

- Response tokens: -5,781, or -80.0%.
- Request tokens: -5,822, or -4.1%.
- All API-body tokens: -11,603, or -7.7%.
- Packet evidence stayed zero on both sides, so this isolates style behavior.

Interpretation:

- `chat` should be positioned as response-token and readability-cost reduction.
- In non-coding conversations, total savings are smaller than response savings
  because each turn still carries the accumulated conversation in the request.
- The clean run had equal request/response counts, unlike interrupted or
  contaminated conversation runs.

## Historical experiment table

| Experiment | Response tokens | Responses | Avg / response | Note |
| --- | ---: | ---: | ---: | --- |
| `lean` | 1,433 | 6 | 239 | Readable, but 17.0% longer than `silent`/`chat`. |
| `silent` | 1,189 | 6 | 198 | Chosen as public `chat`. |
| `wire` | 1,347 | 6 | 225 | Useful research direction, not kept as product mode. |
| `dense` | 1,192 | 6 | 199 | Subjectively fast, later beaten by D2. |
| `dense2` | 1,085 | 6 | 181 | Chosen as public `coding`. |
| `bullet` | 1,481 | 6 | 247 | Close to `lean`, but weaker than `chat`. |
| `patch` | 2,121 | 6 | 354 | Too narrow for mixed prompts. |
| `terse` | 2,045 | 7 | 292 | Non-comparable total due to extra response. |
| `reviewer` | 2,731 | 6 | 455 | Increased output tokens. |
| `wenyan` | 2,583 | 6 | 431 | Increased output tokens. |

## Running a fresh comparison

Start one style run:

```bash
cd /Users/mac/Documents/TokenCap/Tokenless
node plugins/claude-code/bin/tokenless style-benchmark start chat
```

Then run the printed launch command, enter the printed prompts, and collect
stats with the printed stats command.

Repeat for:

```bash
node plugins/claude-code/bin/tokenless style-benchmark start coding
node plugins/claude-code/bin/tokenless style-benchmark start off
```

Use the same prompt order and a fresh Claude Code session for each mode.
