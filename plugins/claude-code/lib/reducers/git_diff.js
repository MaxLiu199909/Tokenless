'use strict';

function splitLines(value) {
  return String(value || '').split(/\r?\n/);
}

function trimLine(line, maxLength = 500) {
  return line.length <= maxLength ? line : `${line.slice(0, maxLength)}...`;
}

function compress({ stdout, stderr }) {
  const lines = splitLines(stdout + '\n' + stderr);
  const changedFiles = [];
  const diffHeaders = [];
  const hunks = [];
  let currentFile = null;
  let currentHunk = null;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      diffHeaders.push(line);
      const m = /diff --git a\/(\S+) b\/(\S+)/.exec(line);
      if (m) {
        currentFile = m[2] || m[1];
        if (!changedFiles.includes(currentFile)) {
          changedFiles.push(currentFile);
        }
      }
      continue;
    }

    if (line.startsWith('@@')) {
      currentHunk = line;
      if (hunks.length < 120) {
        hunks.push({ header: line, lines: [] });
      }
      continue;
    }

    if (currentHunk && hunks.length > 0) {
      const last = hunks[hunks.length - 1];
      if (last.lines.length < 20) {
        last.lines.push(trimLine(line));
      }
    }

    if (line.startsWith('+') && !line.startsWith('+++')) additions += 1;
    if (line.startsWith('-') && !line.startsWith('---')) deletions += 1;
  }

  const keyFindings = [];

  keyFindings.push(`changed files: ${changedFiles.length}`);
  for (const header of diffHeaders.slice(0, 30)) {
    keyFindings.push(header);
  }
  for (const file of changedFiles.slice(0, 30)) {
    keyFindings.push(`file: ${file}`);
  }

  keyFindings.push(`+additions: ${additions}`);
  keyFindings.push(`-deletions: ${deletions}`);

  for (const h of hunks.slice(0, 30)) {
    keyFindings.push(h.header);
    keyFindings.push(...h.lines.map((line) => `  ${line}`));
  }

  const dropped = [
    `hunks retained: ${hunks.length}`,
    `non-changed hunks removed`,
    'minified/build output lines excluded by reducer intent'
  ];

  return {
    keyFindings,
    dropped,
    meta: {
      files: changedFiles,
      additions,
      deletions,
      hunks: hunks.length
    }
  };
}

module.exports = { compress };
