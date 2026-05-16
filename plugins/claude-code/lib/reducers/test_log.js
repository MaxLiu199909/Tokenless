'use strict';

function splitLines(value) {
  return String(value || '').split(/\r?\n/);
}

function trimLine(line, maxLength = 400) {
  if (line == null) return '';
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength)}...`;
}

function getMatches(lines, pattern) {
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      result.push(i);
    }
  }
  return result;
}

function extractContext(lines, idx, radius = 8) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(lines.length - 1, idx + radius);
  const ctx = [];
  for (let i = start; i <= end; i++) {
    ctx.push(i);
  }
  return ctx;
}

function addRange(target, lines, start, end) {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(lines.length - 1, end);
  for (let i = safeStart; i <= safeEnd; i++) {
    target.add(i);
  }
}

function findFailureBlocks(lines, failureSectionIndex, limit = 3) {
  if (failureSectionIndex < 0) return [];

  const blocks = [];
  for (let i = failureSectionIndex + 1; i < lines.length; i++) {
    if (/^\s*\d+\)\s+/.test(lines[i])) {
      blocks.push(i);
      if (blocks.length >= limit) break;
    }
  }

  return blocks;
}

function collectFailureTitles(lines, failureSectionIndex, limit = 25) {
  if (failureSectionIndex < 0) return [];

  const titles = [];
  for (let i = failureSectionIndex + 1; i < lines.length; i++) {
    const match = /^\s*(\d+)\)\s+(.+?)\s*$/.exec(lines[i]);
    if (!match) continue;

    let detail = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
      const candidate = String(lines[j] || '').trim();
      if (!candidate) continue;
      if (/^\d+\)\s+/.test(candidate)) break;
      if (/^(AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|Error|\+ actual|- expected|at\s)/.test(candidate)) break;
      detail = candidate;
      break;
    }

    titles.push(detail ? `${match[1]}) ${match[2]} / ${detail}` : `${match[1]}) ${match[2]}`);
    if (titles.length >= limit) break;
  }

  return titles;
}

function collectFailureFamilies(lines, failureSectionIndex, limit = 8) {
  if (failureSectionIndex < 0) return [];

  const starts = [];
  for (let i = failureSectionIndex + 1; i < lines.length; i++) {
    if (/^\s*\d+\)\s+/.test(lines[i])) {
      starts.push(i);
    }
  }

  const families = new Map();

  for (let index = 0; index < starts.length; index++) {
    const start = starts[index];
    const nextStart = starts[index + 1] || lines.length;
    const block = lines.slice(start, Math.min(nextStart, start + 18)).join('\n');
    const titleMatch = /^\s*(\d+\)\s+.+?)\s*$/.exec(lines[start]);
    const title = titleMatch ? titleMatch[1] : trimLine(lines[start] || '');

    let family = 'Unclassified failure';
    const missingModule = /Cannot find module ['"]([^'"]+)['"]/.exec(block);
    const timeout = /Timeout of \d+ms exceeded/.exec(block);
    const typedError = /\b(TypeError|ReferenceError|SyntaxError|RangeError|Error):\s*([^\n]+)/.exec(block);

    if (/Expected values to be strictly deep-equal/.test(block) && /\+\s*\[/.test(block)) {
      family = 'Wrapped array/object shape mismatch';
    } else if (/Missing expected exception/.test(block)) {
      family = 'Missing expected exception';
    } else if (missingModule) {
      family = `Missing module: ${missingModule[1]}`;
    } else if (timeout) {
      family = 'Async timeout';
    } else if (/Snapshot mismatch/.test(block)) {
      family = 'Snapshot mismatch';
    } else if (/Cannot read properties of undefined/.test(block)) {
      family = 'Undefined property access';
    } else if (/AssertionError/.test(block)) {
      family = 'Assertion failure';
    } else if (typedError) {
      family = `${typedError[1]}: ${typedError[2].slice(0, 80)}`;
    }

    if (!families.has(family)) {
      families.set(family, {
        name: family,
        count: 0,
        examples: []
      });
    }

    const item = families.get(family);
    item.count += 1;
    if (item.examples.length < 3) {
      item.examples.push(title);
    }
  }

  return [...families.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => `${item.name}: ${item.count} failure${item.count === 1 ? '' : 's'}; examples: ${item.examples.join(' | ')}`);
}

function compress({ command, exitCode, stdout, stderr }) {
  const lines = splitLines(stdout + '\n' + stderr);
  const filePattern = /((?:[.\/]?[\w-]+\/)*[\w.-]+\.(?:tsx|ts|jsx|js|mjs|cjs|py|go|rs|java|kt|rb|php))(?::(\d+))?/;
  const stackPattern = /,\s*line\s+(\d+)\)/;
  const focusPattern = /\bFAILED\b|\bFAILURES\b|AssertionError|Traceback|Expected values|^\s*(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|YAMLException):|\bReceived:/;
  const failureSectionPattern = /FAILURES|short test summary|failing tests|^\s*\d+\s+failing\b/i;
  const summaryPattern = /^\s*(?:\d+\s+)?(?:tests?|test suites?|suites?)\b.*\b(?:failed|passed|skipped|todo)\b|^\s*\d+\s+(?:passing|failing|pending|failed|passed|skipped)\b/i;

  const keyLines = new Set();

  const hitIndexes = getMatches(lines, focusPattern);
  const failureSectionIndex = lines.findIndex((line) => failureSectionPattern.test(line));

  if (exitCode === 0 && hitIndexes.length === 0 && failureSectionIndex < 0) {
    const summaryLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (summaryPattern.test(lines[i])) {
        summaryLines.push(`${i + 1}: ${trimLine(lines[i] || '')}`);
      }
    }

    return {
      keyFindings: summaryLines.length ? summaryLines.slice(-12) : ['No failures detected.'],
      dropped: [
        'command succeeded',
        'successful test cases discarded',
        'no assertion or failure section found'
      ],
      meta: {
        files: [],
        command,
        exitCode
      }
    };
  }

  hitIndexes.slice(0, failureSectionIndex >= 0 ? 0 : 16).forEach((idx) => {
    const around = extractContext(lines, idx, failureSectionIndex >= 0 ? 3 : 8);
    around.forEach((ln) => {
      keyLines.add(ln);
    });
  });

  const fileMatches = [];
  for (let i = 0; i < lines.length; i++) {
    const match = filePattern.exec(lines[i]);
    const inFailureSection = failureSectionIndex >= 0 && i >= failureSectionIndex;
    if (match) {
      if (focusPattern.test(lines[i])) {
        keyLines.add(i);
      }
      if (focusPattern.test(lines[i]) || inFailureSection) {
        fileMatches.push(`${match[1]}:${match[2] || '?'}`);
      }
      continue;
    }

    const stackMatch = stackPattern.exec(lines[i]);
    if (stackMatch) {
      const maybeFile = lines[i].match(/([\w.\/-]+\.[A-Za-z0-9_]+)/);
      if (maybeFile) {
        keyLines.add(i);
        fileMatches.push(`${maybeFile[1]}:${stackMatch[1] || '?'}`);
      }
    }
  }

  const relevantFiles = [...new Set(fileMatches)].slice(0, 12);

  if (failureSectionIndex >= 0) {
    addRange(keyLines, lines, failureSectionIndex - 4, failureSectionIndex + 2);

    const failureBlocks = findFailureBlocks(lines, failureSectionIndex, 3);
    for (let blockIndex = 0; blockIndex < failureBlocks.length; blockIndex++) {
      const start = failureBlocks[blockIndex];
      const nextStart = failureBlocks[blockIndex + 1] || lines.length;
      const end = Math.min(nextStart - 1, start + 10);
      addRange(keyLines, lines, start, end);
    }

    if (failureBlocks.length === 0) {
      addRange(keyLines, lines, failureSectionIndex, failureSectionIndex + 35);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (
      summaryPattern.test(lines[i]) &&
      !/passing case/i.test(lines[i]) &&
      !/^\s*(PASSED|ok)\b/i.test(lines[i])
    ) {
      keyLines.add(i);
    }
  }

  if (hitIndexes.length === 0 && failureSectionIndex < 0) {
    const tailStart = Math.max(0, lines.length - 80);
    for (let i = tailStart; i < lines.length; i++) {
      keyLines.add(i);
    }
  }

  const sorted = [...keyLines].sort((a, b) => a - b);
  const dedup = Array.from(new Set(sorted));

  const summaryFindings = [];
  for (let i = 0; i < lines.length; i++) {
    if (summaryPattern.test(lines[i])) {
      summaryFindings.push(`${i + 1}: ${trimLine(lines[i] || '')}`);
    }
  }

  const failureTitles = collectFailureTitles(lines, failureSectionIndex, 25);
  const failureFamilies = collectFailureFamilies(lines, failureSectionIndex, 8);
  const detailFindings = dedup
    .map((idx) => `${idx + 1}: ${trimLine(lines[idx] || '')}`)
    .filter((line) => line.trim().length > 1)
    .slice(0, failureSectionIndex >= 0 ? 65 : 140);

  const keyFindings = [
    ...summaryFindings.slice(-8),
    ...(failureFamilies.length ? ['Failure families:', ...failureFamilies] : []),
    ...(failureTitles.length ? ['Failure index (first 25):', ...failureTitles] : []),
    ...(detailFindings.length ? ['Representative failure details:', ...detailFindings] : [])
  ];

  const dropped = [
    `matched ${hitIndexes.length} failure/relevant signatures`,
    `captured ${relevantFiles.length} file:line hints`,
    failureSectionIndex >= 0 ? `failure section starts at line ${failureSectionIndex + 1}; first 3 failure blocks retained` : 'no explicit failure section found',
    'other test cases / progress lines discarded'
  ];

  if (failureTitles.length >= 25) {
    dropped.push('failure index truncated after first 25 failures; inspect raw artifact or expand if failures look independent');
  }

  if (relevantFiles.length) {
    dropped.push(`relevant files: ${relevantFiles.join(', ')}`);
  }

  return {
    keyFindings: keyFindings.length ? keyFindings : ['- no strong failure signal found'],
    dropped,
    meta: {
      files: relevantFiles,
      command,
      exitCode
    }
  };
}

module.exports = { compress };
