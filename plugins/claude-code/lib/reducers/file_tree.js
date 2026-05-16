'use strict';

function splitLines(value) {
  return String(value || '').split(/\r?\n/).filter(Boolean);
}

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache'];

function compress({ stdout, stderr }) {
  const lines = splitLines(stdout + '\n' + stderr);
  const dirCounts = {};
  const ignored = new Set();

  for (const raw of lines) {
    const entry = raw.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    if (!entry) continue;

    const segments = entry.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    const top = segments[0];
    if (IGNORED_DIRS.includes(top)) {
      ignored.add(top);
      continue;
    }

    const prefix = `${top}/`;
    dirCounts[prefix] = (dirCounts[prefix] || 0) + 1;
  }

  const summary = Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([dir, count]) => `- ${dir}: ${count} files`);

  const largeDirs = [...ignored].sort().map((d) => `- ${d}/: omitted`);

  const keyFindings = ['Project tree summary:'];
  if (summary.length === 0) {
    keyFindings.push('- no files detected');
  } else {
    keyFindings.push(...summary);
  }

  if (largeDirs.length) {
    keyFindings.push('Large dirs collapsed:');
    keyFindings.push(...largeDirs);
  }

  const dropped = ['raw tree lines reduced to summary'];

  return {
    keyFindings,
    dropped,
    meta: {
      collapsedDirs: [...ignored],
      totalDirs: Object.keys(dirCounts).length
    }
  };
}

module.exports = { compress };
