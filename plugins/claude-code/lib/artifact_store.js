'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureArtifactDir(dataDir) {
  const base = path.resolve(dataDir || path.join(process.cwd(), '.acc'));
  const artifactRoot = path.join(base, 'artifacts');
  fs.mkdirSync(artifactRoot, { recursive: true });
  return artifactRoot;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value || '', 'utf8').digest('hex');
}

function formatArtifactId() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = p(now.getMonth() + 1);
  const d = p(now.getDate());
  const h = p(now.getHours());
  const mm = p(now.getMinutes());
  const s = p(now.getSeconds());
  const rand = Math.random().toString(36).slice(2, 6);
  return `ctx_${y}${m}${d}_${h}${mm}${s}_${rand}`;
}

function createArtifact({ dataDir, command, exitCode, reducer, stdout = '', stderr = '', compactedText = '', beforeTokens = 0, afterTokens = 0, status }) {
  const artifactRoot = ensureArtifactDir(dataDir);
  const artifactId = formatArtifactId();
  const artifactDir = path.join(artifactRoot, artifactId);
  fs.mkdirSync(artifactDir, { recursive: true });

  const createdAt = new Date().toISOString();
  const meta = {
    artifact_id: artifactId,
    created_at: createdAt,
    cwd: process.cwd(),
    command,
    exit_code: exitCode,
    status: status || (exitCode === 0 ? 'success' : 'failed'),
    bytes_stdout: Buffer.byteLength(stdout || ''),
    bytes_stderr: Buffer.byteLength(stderr || ''),
    sha256_stdout: sha256(stdout || ''),
    sha256_stderr: sha256(stderr || ''),
    reducer
  };

  fs.writeFileSync(path.join(artifactDir, 'raw.stdout'), stdout, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'raw.stderr'), stderr, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'compacted.txt'), compactedText, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'meta.json'), JSON.stringify({ ...meta, beforeTokens, afterTokens }, null, 2), 'utf8');

  return meta;
}

function createArtifactFromFallback(params) {
  return createArtifact(params);
}

function readArtifact(dataDir, artifactId) {
  const artifactRoot = ensureArtifactDir(dataDir);
  const artifactDir = path.join(artifactRoot, artifactId);
  const metaPath = path.join(artifactDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return null;
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const stdout = fs.readFileSync(path.join(artifactDir, 'raw.stdout'), 'utf8');
  const stderr = fs.readFileSync(path.join(artifactDir, 'raw.stderr'), 'utf8');

  return { meta, stdout, stderr };
}

function listArtifacts(dataDir) {
  const artifactRoot = ensureArtifactDir(dataDir);
  const entries = fs.readdirSync(artifactRoot, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metaPath = path.join(artifactRoot, entry.name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      artifacts.push(meta);
    } catch (err) {
      artifacts.push({
        artifact_id: entry.name,
        created_at: 'unknown',
        status: 'unknown',
        reducer: 'unknown',
        command: `(unreadable meta: ${err.message})`
      });
    }
  }

  return artifacts.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function expandArtifactAround(artifact, keyword) {
  const raw = `${artifact.stdout}\n${artifact.stderr}`.split(/\r?\n/);
  const lines = raw;
  const matches = [];

  const target = String(keyword || '').trim();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(target)) {
      matches.push(i);
      if (matches.length >= 20) {
        break;
      }
    }
  }

  if (matches.length === 0) {
    return '';
  }

  const out = [];
  const seen = new Set();

  for (const index of matches) {
    const start = Math.max(0, index - 50);
    const end = Math.min(lines.length - 1, index + 50);

    for (let i = start; i <= end; i++) {
      const key = String(i);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`${i + 1}: ${lines[i]}`);
    }
    out.push(`--- around ${keyword} at line ${index + 1} ---`);
  }

  return out.join('\n');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function formatArtifactPointer(artifactId, options = {}) {
  if (options.accPath && options.dataDir) {
    return `node ${shellQuote(options.accPath)} show ${artifactId} --data-dir ${shellQuote(options.dataDir)}`;
  }
  return `acc show ${artifactId}`;
}

module.exports = {
  ensureArtifactDir,
  createArtifact,
  createArtifactFromFallback: createArtifactFromFallback,
  readArtifact,
  listArtifacts,
  expandArtifactAround,
  formatArtifactPointer
};
