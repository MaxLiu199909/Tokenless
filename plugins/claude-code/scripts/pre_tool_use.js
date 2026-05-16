#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { isNoisyCommand } = require('../lib/classify');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function getAccCliPath() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  return path.join(pluginRoot, 'bin', 'acc');
}

function trace(event) {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.acc');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(
      path.join(dataDir, 'pretool_trace.log'),
      `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
      'utf8'
    );
  } catch (err) {
    // Tracing must never break tool execution.
  }
}

function getPermissionDecision() {
  const value = String(process.env.TOKENLESS_PRETOOL_PERMISSION || 'deny').trim();
  if (value === 'allow' || value === 'ask' || value === 'deny') {
    return value;
  }
  return 'deny';
}

function isAccCommand(command) {
  return /^\s*acc(\s|$)/.test(command) || /\/bin\/acc['"]?\s+run\s+/.test(command);
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
    trace({ event: 'skip', reason: 'not-bash', tool: input.tool_name || input.toolName });
    process.exit(0);
  }

  const toolInput = input.tool_input || input.toolInput || {};
  const command = toolInput.command || '';

  if (!command || typeof command !== 'string') {
    trace({ event: 'skip', reason: 'empty-command' });
    process.exit(0);
  }

  if (isAccCommand(command)) {
    trace({ event: 'skip', reason: 'acc-recursion', command });
    process.exit(0);
  }

  if (!isNoisyCommand(command)) {
    trace({ event: 'skip', reason: 'not-noisy', command });
    process.exit(0);
  }

  const dataDir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.acc');
  const accCliPath = getAccCliPath();
  const encodedCommand = Buffer.from(command, 'utf8').toString('base64');
  const rewritten = `node ${shellQuote(accCliPath)} run --agent --data-dir ${shellQuote(dataDir)} --cmd-b64 ${shellQuote(encodedCommand)}`;

  const updatedInput = {
    ...toolInput,
    command: rewritten,
    description: toolInput.description
      ? `${toolInput.description} (compressed by Tokenless)`
      : `Run compressed command: ${command}`
  };

  const permissionDecision = getPermissionDecision();

  trace({ event: 'rewrite', mode: permissionDecision, command, rewritten });

  if (permissionDecision === 'deny') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: [
            'Tokenless is capping this noisy Bash output before it enters model context.',
            'Run the compacted command instead:',
            rewritten
          ].join('\n')
        }
      })
    );
    return;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        permissionDecisionReason: 'Tokenless rewrote noisy Bash command through local compression. Approve the rewritten command to keep raw output out of model context.',
        updatedInput
      }
    })
  );
}

main();
