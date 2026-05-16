#!/usr/bin/env node
'use strict';

const { estimateTokens, compactOutput } = require('../lib/compact');
const { getReducerForOutput } = require('../lib/classify');
const { createArtifactFromFallback, ensureArtifactDir, formatArtifactPointer } = require('../lib/artifact_store');
const fs = require('fs');
const path = require('path');

function getAccCliPath() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  return path.join(pluginRoot, 'bin', 'acc');
}

function main() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch (err) {
    process.exit(0);
  }

  if (!raw || !raw.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (err) {
    process.exit(0);
  }

  if ((input.tool_name || input.toolName) !== 'Bash') {
    process.exit(0);
  }

  const toolInput = input.tool_input || input.toolInput || {};
  const response = input.tool_response || input.toolResponse || {};
  const command = toolInput.command || '';
  const stdout = response.stdout || '';
  const stderr = response.stderr || '';
  const interrupted = Boolean(response.interrupted);
  const isImage = Boolean(response.isImage);
  const exitCode = Number.isInteger(response.exit_code)
    ? response.exit_code
    : (Number.isInteger(response.exitCode) ? response.exitCode : 0);

  const combined = `${stdout}\n${stderr}`;
  if (estimateTokens(combined) < 8000) {
    process.exit(0);
  }

  const reducer = getReducerForOutput({ command, stdout, stderr }) || 'bash_generic';
  const compacted = compactOutput({
    tool: 'Bash',
    command,
    exitCode,
    stdout,
    stderr,
    reducer,
    artifactId: null,
    dataDir: process.env.CLAUDE_PLUGIN_DATA,
    beforeText: combined
  });

  let artifactId;
  try {
    ensureArtifactDir(process.env.CLAUDE_PLUGIN_DATA);
    const stored = createArtifactFromFallback({
      dataDir: process.env.CLAUDE_PLUGIN_DATA,
      command,
      exitCode,
      reducer,
      stdout,
      stderr,
      compactedText: compacted.text,
      beforeTokens: compacted.beforeTokens,
      afterTokens: compacted.afterTokens,
      status: compacted.status
    });
    artifactId = stored.artifact_id;
  } catch (err) {
    artifactId = null;
  }

  const artifactPointer = artifactId
    ? formatArtifactPointer(artifactId, {
      accPath: getAccCliPath(),
      dataDir: process.env.CLAUDE_PLUGIN_DATA
    })
    : null;
  const compactText = compacted.text.replace('Raw artifact: acc show null', artifactPointer ? `Raw artifact: ${artifactPointer}` : 'Raw artifact: unavailable (post-hook storage failed)');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: {
          stdout: compactText,
          stderr: '',
          interrupted,
          isImage
        }
      }
    })
  );
}

main();
