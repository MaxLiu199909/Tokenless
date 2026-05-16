'use strict';

function splitLines(value) {
  return String(value || '').split(/\r?\n/).filter(Boolean);
}

function normalizeLine(line) {
  return line.trim();
}

function getFileFromLine(line) {
  // rg/grep -n format: path:line:content
  const withLine = /^(.*?):(\d+):(.*)$/.exec(line);
  if (withLine) {
    return { file: withLine[1], line: Number(withLine[2]), text: withLine[3] };
  }

  // rg without --line-number can produce path:content.
  const withoutLine = /^([^:\s][^:]*?):(.+)$/.exec(line);
  if (withoutLine && /\.[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(withoutLine[1].split('/').pop() || '')) {
    return { file: withoutLine[1], line: null, text: withoutLine[2] };
  }

  return null;
}

function isIgnoredFile(file) {
  return /(^|\/)(\.git|node_modules|dist|build|coverage|\.next|\.cache)(\/|$)/.test(file) ||
    /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file);
}

function compress({ stdout, stderr }) {
  const lines = splitLines(stdout + '\n' + stderr);
  const grouped = new Map();
  const fileOrder = [];

  for (const raw of lines) {
    const normalized = normalizeLine(raw);
    if (!normalized) continue;
    const parsed = getFileFromLine(normalized);
    if (!parsed) continue;
    const file = parsed.file.replace(/\\/g, '/');

    if (isIgnoredFile(file)) continue;

    if (!grouped.has(file)) {
      grouped.set(file, []);
      fileOrder.push(file);
    }

    grouped.get(file).push({ line: parsed.line, text: parsed.text.trim() });
  }

  const topFiles = fileOrder.slice(0, 30);
  const keyFindings = [];
  const dropped = [];

  for (const file of topFiles) {
    const matches = grouped.get(file) || [];
    keyFindings.push(`${file}`);
    const shown = matches.slice(0, 5);
    for (const item of shown) {
      const location = item.line == null ? 'match' : `line ${item.line}`;
      keyFindings.push(`- ${location}: ${item.text}`);
    }

    if (matches.length > 5) {
      keyFindings.push(`- ${matches.length - 5} more matches omitted`);
      dropped.push(`${file} extra matches omitted: ${matches.length - 5}`);
    }
  }

  if (topFiles.length < grouped.size) {
    dropped.push(`files omitted: ${grouped.size - topFiles.length}`);
  }

  return {
    keyFindings,
    dropped,
    meta: {
      files: topFiles,
      totalFiles: grouped.size
    }
  };
}

module.exports = { compress };
