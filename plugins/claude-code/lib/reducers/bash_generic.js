'use strict';

function trimLine(line, maxLength = 400) {
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength)}...`;
}

function collapseRepeats(lines) {
  if (!lines.length) return [];
  const out = [];
  let prev = lines[0];
  let count = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === prev) {
      count += 1;
      continue;
    }
    if (count > 1) {
      out.push(`${prev} (x${count})`);
    } else {
      out.push(prev);
    }
    prev = line;
    count = 1;
  }

  if (count > 1) {
    out.push(`${prev} (x${count})`);
  } else {
    out.push(prev);
  }

  return out;
}

function splitLines(value) {
  if (!value) return [];
  return String(value).split(/\r?\n/);
}

function compress({ command, exitCode, stdout, stderr }) {
  const combined = splitLines(stdout + '\n' + stderr)
    .map((line) => trimLine(line));

  const errorPattern = /error|warn|fatal|failed|failure|exception|traceback|panic/i;
  const errorLines = combined.filter((line) => errorPattern.test(line));

  const tail = combined.slice(-100);

  const keySource = errorLines.length ? errorLines : tail;
  const keyFindings = collapseRepeats(keySource.slice(0, 80));

  const dropped = [];
  if (combined.length > keySource.length) {
    dropped.push(`kept ${keySource.length} of ${combined.length} lines`);
    dropped.push('collapsed repeated lines');
  }

  if (stderr && stderr.trim()) {
    dropped.push('kept stderr lines containing error/warning context');
  }

  if (stdout && stdout.length > 0 && stderr && stderr.length === 0) {
    dropped.push('removed large non-error stdout body');
  }

  return {
    keyFindings,
    dropped,
    raw: {
      command,
      exitCode,
      linesKept: keyFindings.length,
      linesTotal: combined.length
    }
  };
}

module.exports = { compress };
