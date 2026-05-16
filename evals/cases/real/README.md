# Real Eval Cases

Put real logs in this directory as `*.case.json` plus raw log files.

Example:

```json
{
  "name": "github actions node build failure",
  "command": "npm run build",
  "exitCode": 1,
  "rawFile": "github-actions-node-build.log",
  "expectedReducer": "ci-build",
  "mustContain": [
    "failed phase: build",
    "Cannot find module",
    "src/App.tsx:12"
  ],
  "mustExpandAround": [
    "Cannot find module"
  ],
  "maxTokensAfter": 2200,
  "maxRatioPercent": 10
}
```

Supported fields:
- `name`: human-readable case name
- `command`: command that produced the log
- `exitCode`: original command exit code
- `rawFile`: combined stdout/stderr log file
- `stdoutFile` and `stderrFile`: use these instead of `rawFile` when split logs are available
- `expectedReducer`: expected reducer name
- `mustContain`: tokens that must appear in compacted output
- `mustNotContain`: tokens that must not appear in compacted output
- `mustExpandAround`: tokens that must be recoverable through raw artifact expansion
- `maxTokensAfter`: upper bound for compacted output
- `maxRatioPercent`: upper bound for compressed/original token ratio when the raw case is large enough
- `minTokensForRatio`: minimum original token count before `maxRatioPercent` is enforced; default is `1000`

Run:

```bash
node evals/run_eval.js --real
```

Capture a real command into a case:

```bash
node evals/capture_real_case.js \
  --name local-node-build-failure \
  --command "npm run build" \
  --expectedReducer ci-build \
  --mustContain "Missing script" \
  --mustExpandAround "Missing script"
```

Generate deterministic local real cases without network access:

```bash
node evals/generate_real_cases.js
node evals/run_eval.js --real
```
