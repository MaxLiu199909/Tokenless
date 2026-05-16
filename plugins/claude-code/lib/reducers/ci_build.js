'use strict';

function splitLines(value) {
  return String(value || '').split(/\r?\n/);
}

function trimLine(line, maxLength = 500) {
  if (line == null) return '';
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength)}...`;
}

function dedupe(values, limit) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = trimLine(String(value || '').trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

function collectContext(lines, indexes, radius, limit) {
  const collected = [];
  const seen = new Set();

  for (const idx of indexes) {
    const start = Math.max(0, idx - radius);
    const end = Math.min(lines.length - 1, idx + radius);
    for (let i = start; i <= end; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      collected.push(`${i + 1}: ${trimLine(lines[i])}`);
      if (collected.length >= limit) {
        return collected;
      }
    }
  }

  return collected;
}

function detectPhase(line) {
  const lower = String(line || '').toLowerCase();
  if (/install|npm ci|npm install|pnpm install|yarn install|dependencies/.test(lower)) return 'install';
  if (/build|compile|bundl|vite|webpack|next build|tsc/.test(lower)) return 'build';
  if (/test|pytest|jest|vitest|cargo test|go test|surefire/.test(lower)) return 'test';
  if (/deploy|vercel|netlify|release|upload/.test(lower)) return 'deploy';
  if (/docker|image|container/.test(lower)) return 'docker';
  if (/kubectl|kubernetes|pod|deployment|ingress|service/.test(lower)) return 'kubernetes';
  return null;
}

function guessCause(lines) {
  const joined = lines.join('\n');
  const checks = [
    [/Missing script/i, 'missing package script'],
    [/Cannot find module|MODULE_NOT_FOUND|package not found|Could not resolve|Can't resolve/i, 'missing or unresolved dependency'],
    [/not set|missing.*env|required environment|undefined environment|environment variable/i, 'missing environment variable or config'],
    [/permission denied|EACCES|unauthorized|forbidden|401|403/i, 'permission or credentials problem'],
    [/No space left|ENOSPC|out of memory|JavaScript heap out of memory|OOM/i, 'resource limit'],
    [/version conflict|peer dep|ERESOLVE|incompatible|requires Node|unsupported engine/i, 'dependency or runtime version conflict'],
    [/timeout|timed out|ECONNRESET|ETIMEDOUT|network/i, 'network or timeout failure'],
    [/Type error|TS\d+|eslint|lint/i, 'typecheck or lint failure'],
    [/failed to solve|dockerfile|image.*not found|pull access denied/i, 'docker build or image resolution failure'],
    [/CrashLoopBackOff|ImagePullBackOff|ErrImagePull|Readiness probe failed|Liveness probe failed/i, 'kubernetes workload health failure']
  ];

  for (const [pattern, cause] of checks) {
    if (pattern.test(joined)) return cause;
  }

  return 'unknown from compacted output; inspect raw artifact if needed';
}

function compress({ command, exitCode, stdout, stderr }) {
  const stdoutLines = splitLines(stdout);
  const stderrLines = splitLines(stderr);
  const lines = splitLines(`${stdout}\n${stderr}`);

  const phaseHits = [];
  const phaseTransitions = [];
  const failureIndexes = [];
  const commandLines = [];
  const fileHints = [];
  const stderrSignals = [];

  const failurePattern = /error|failed|failure|fatal|exception|traceback|panic|npm ERR!|ERR!|Command failed|Process completed with exit code|exit code [1-9]|ELIFECYCLE|BUILD FAILED|Compilation failed/i;
  const filePattern = /([\w./-]+\.(?:tsx|ts|jsx|js|mjs|cjs|json|py|go|rs|java|kt|xml|yaml|yml|sh|scss|css|md))(?::(\d+))?/;
  const commandPattern = /^\s*(Run |>|npm ERR! command |Command failed:|Executing |Step \d+\/\d+ :|#\d+\s+\[)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const phase = detectPhase(line);
    if (phase) {
      phaseHits.push(phase);
      phaseTransitions.push({ index: i, phase });
    }
    if (failurePattern.test(line)) failureIndexes.push(i);
    if (commandPattern.test(line)) commandLines.push({ index: i, line });

    const fileMatch = filePattern.exec(line);
    if (fileMatch) {
      fileHints.push(`${fileMatch[1]}:${fileMatch[2] || '?'}`);
    }
  }

  for (const line of stderrLines) {
    if (line.trim() && failurePattern.test(line)) {
      stderrSignals.push(line);
    }
  }

  const firstFailure = failureIndexes.length ? failureIndexes[0] : lines.length;
  let failedPhase = dedupe(phaseHits, 1)[0] || 'unknown';
  if (failureIndexes.length && phaseTransitions.length) {
    const nearest = phaseTransitions
      .filter((item) => item.index <= firstFailure)
      .slice(-1)[0];
    if (nearest) {
      failedPhase = nearest.phase;
    }
  }

  const nearbyCommandLines = [
    ...commandLines.filter((item) => item.index <= firstFailure).slice(-8),
    ...commandLines.filter((item) => item.index > firstFailure).slice(0, 4)
  ].map((item) => item.line);
  const context = collectContext(lines, failureIndexes.slice(0, 20), 6, 90);
  const stderrContext = dedupe(stderrSignals, 30).map((line) => `stderr: ${line}`);
  const relatedFiles = dedupe(fileHints, 20);
  const failedCommands = dedupe(nearbyCommandLines, 12);
  const tail = lines.slice(-60).map((line, idx) => `${lines.length - 60 + idx + 1}: ${trimLine(line)}`).filter((line) => !line.endsWith(': '));

  const keyFindings = [
    `failed phase: ${failedPhase}`,
    `suspected cause: ${guessCause(lines)}`,
    `original exit code: ${exitCode}`,
    ...failedCommands.map((line) => `failed/nearby command: ${line}`),
    ...relatedFiles.map((file) => `related file: ${file}`),
    ...stderrContext,
    ...(context.length ? context : tail.slice(0, 40))
  ].slice(0, 180);

  const dropped = [
    `stdout lines: ${stdoutLines.length}`,
    `stderr lines: ${stderrLines.length}`,
    `failure signatures: ${failureIndexes.length}`,
    `related file hints: ${relatedFiles.length}`,
    'install progress, repeated warnings, and long successful sections omitted'
  ];

  return {
    keyFindings,
    dropped,
    meta: {
      command,
      exitCode,
      failedPhase,
      relatedFiles,
      failedCommands: failedCommands.slice(0, 12)
    }
  };
}

module.exports = { compress };
