'use strict';

const NOISY_PATTERNS = [
  /^npm\s+(?:test|run\s+test)\b/,
  /^npm\s+(?:run\s+)?(?:build|lint|typecheck|ci|install)\b/,
  /^pnpm\s+(?:test|run\s+test)\b/,
  /^pnpm\s+(?:run\s+)?(?:build|lint|typecheck|install)\b/,
  /^yarn\s+(?:test|run\s+test)\b/,
  /^yarn\s+(?:run\s+)?(?:build|lint|typecheck|install)\b/,
  /^pytest\b/,
  /^go\s+test\b/,
  /^cargo\s+test\b/,
  /^mvn\s+(?:test|verify|package|install)\b/,
  /^gradle\s+(?:test|build)\b/,
  /^\.\/gradlew\s+(?:test|build)\b/,
  /^git\s+diff\b/,
  /^git\s+log\b/,
  /^rg\b/,
  /^grep\s+-R\b/,
  /^find\b/,
  /^tree\b/,
  /^ls\s+-R\b/,
  /^docker\s+(?:logs|build|compose)\b/,
  /^kubectl\s+(?:logs|describe|get\s+events)\b/,
  /^vercel\b/,
  /^netlify\b/
];

function normalizeCommand(command) {
  return String(command || '').trim();
}

function stripLeadingEnvAssignments(command) {
  return normalizeCommand(command).replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s+)+/, '');
}

function normalizePackageManagerCommand(command) {
  const parts = stripLeadingEnvAssignments(command).split(/\s+/);
  const manager = parts[0];
  if (!['npm', 'pnpm', 'yarn'].includes(manager)) {
    return stripLeadingEnvAssignments(command);
  }

  const normalized = [manager];
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (['-C', '--prefix', '--cwd'].includes(part)) {
      i += 1;
      continue;
    }
    if (part.startsWith('--prefix=') || part.startsWith('--cwd=')) {
      continue;
    }
    normalized.push(part);
  }

  return normalized.join(' ');
}

function getCommandSegments(command) {
  const normalized = normalizeCommand(command);
  if (!normalized) return [];

  return normalized
    .split(/\s*(?:&&|\|\||;)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isBoundedPipeline(command) {
  const normalized = normalizeCommand(command);
  if (!/\|/.test(normalized)) return false;

  return /\|\s*(?:head|tail)\b/.test(normalized) ||
    /\|\s*wc\b/.test(normalized) ||
    /\|\s*grep\b/.test(normalized) ||
    /\|\s*rg\b/.test(normalized) ||
    /\|\s*sed\s+-n\s+['"]?\d+,\d+p['"]?/.test(normalized);
}

function isPackageManagerNoisy(segment) {
  const normalized = normalizePackageManagerCommand(segment);
  return /^npm\s+(?:test|run\s+test)\b/.test(normalized) ||
    /^npm\s+(?:run\s+)?(?:build|lint|typecheck|ci|install)\b/.test(normalized) ||
    /^pnpm\s+(?:test|run\s+test)\b/.test(normalized) ||
    /^pnpm\s+(?:run\s+)?(?:build|lint|typecheck|install)\b/.test(normalized) ||
    /^yarn\s+(?:test|run\s+test)\b/.test(normalized) ||
    /^yarn\s+(?:run\s+)?(?:build|lint|typecheck|install)\b/.test(normalized);
}

function isNarrowedCommand(command) {
  const normalized = normalizeCommand(command);

  if (isPackageManagerNoisy(normalized)) return false;

  if (isBoundedPipeline(normalized)) return true;

  return /^rg\b.*(?:\s-m\s*\d+|\s--max-count(?:=|\s+)\d+|\s--files\b|\s-l\b|\s--files-with-matches\b)/.test(normalized) ||
    /^grep\b.*(?:\s-m\s*\d+|\s-l\b)/.test(normalized) ||
    /^find\b.*(?:\s-maxdepth\s+\d+|\s-name\s+|\s-type\s+)/.test(normalized);
}

function isNoisyCommand(command) {
  const segments = getCommandSegments(command);
  return segments.some((segment) => {
    if (isPackageManagerNoisy(segment)) return true;
    if (isNarrowedCommand(segment)) return false;
    const normalizedPackageCommand = normalizePackageManagerCommand(segment);
    return NOISY_PATTERNS.some((pattern) => pattern.test(segment) || pattern.test(normalizedPackageCommand));
  });
}

function getReducerForCommand(command) {
  const segments = getCommandSegments(command);
  const normalized = segments.find((segment) => {
    const normalizedPackageCommand = normalizePackageManagerCommand(segment);
    return NOISY_PATTERNS.some((pattern) => pattern.test(segment) || pattern.test(normalizedPackageCommand));
  }) ||
    normalizeCommand(command);
  const normalizedPackageCommand = normalizePackageManagerCommand(normalized);

  if (/^(npm|pnpm|yarn)\s+(test|run\s+test)\b/.test(normalizedPackageCommand) || /^pytest\b|^go\s+test\b|^cargo\s+test\b/.test(normalized)) {
    return 'test-log';
  }
  if (
    /^(npm|pnpm|yarn)\s+(run\s+)?(build|lint|typecheck|ci|install)\b/.test(normalizedPackageCommand) ||
    /^mvn\s+(test|verify|package|install)\b/.test(normalized) ||
    /^(gradle|\.\/gradlew)\s+(test|build)\b/.test(normalized) ||
    /^docker\s+(build|compose)\b/.test(normalized) ||
    /^kubectl\s+(logs|describe|get\s+events)\b/.test(normalized) ||
    /^(vercel|netlify)\b/.test(normalized)
  ) {
    return 'ci-build';
  }
  if (/^git\s+diff\b/.test(normalized)) {
    return 'git-diff';
  }
  if (/^rg\b/.test(normalized) || /^grep\s+-R\b/.test(normalized)) {
    return 'search-output';
  }
  if (/^(find|tree|ls\s+-R)\b/.test(normalized)) {
    return 'file-tree';
  }

  return 'bash_generic';
}

function getReducerForOutput({ command, stdout, stderr }) {
  const commandReducer = getReducerForCommand(command);
  if (commandReducer !== 'bash_generic') {
    return commandReducer;
  }

  const output = `${stdout || ''}\n${stderr || ''}`;
  if (/^diff --git /m.test(output)) {
    return 'git-diff';
  }
  if (/FAIL|FAILED|AssertionError|Traceback|short test summary|Jest|Vitest|pytest/i.test(output)) {
    return 'test-log';
  }
  if (/Process completed with exit code|npm ERR!|npm error|error Command failed|BUILD FAILED|Compilation failed|Cannot find module|TS\d+|failed to solve|CrashLoopBackOff|ImagePullBackOff|Vercel|Netlify/i.test(output)) {
    return 'ci-build';
  }

  return commandReducer;
}

module.exports = {
  isNoisyCommand,
  getReducerForCommand,
  getReducerForOutput,
  getCommandSegments,
  isNarrowedCommand,
  normalizePackageManagerCommand,
  NOISY_PATTERNS
};
