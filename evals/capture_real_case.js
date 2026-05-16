#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function usage() {
  console.log('Usage:');
  console.log('  node evals/capture_real_case.js --name <slug> --command "<command>" [--expectedReducer ci-build] [--mustContain "text"]');
}

function parseArgs(argv) {
  const parsed = {
    mustContain: [],
    mustExpandAround: [],
    maxTokensAfter: 2200,
    maxRatioPercent: 20
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--name') {
      parsed.name = argv[++i];
    } else if (arg === '--command') {
      parsed.command = argv[++i];
    } else if (arg === '--expectedReducer') {
      parsed.expectedReducer = argv[++i];
    } else if (arg === '--mustContain') {
      parsed.mustContain.push(argv[++i]);
    } else if (arg === '--mustExpandAround') {
      parsed.mustExpandAround.push(argv[++i]);
    } else if (arg === '--maxTokensAfter') {
      parsed.maxTokensAfter = Number(argv[++i]);
    } else if (arg === '--maxRatioPercent') {
      parsed.maxRatioPercent = Number(argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
  }

  if (!parsed.name || !parsed.command) {
    usage();
    process.exit(1);
  }

  return parsed;
}

function safeSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const slug = safeSlug(options.name);
  const realDir = path.join(__dirname, 'cases', 'real');
  fs.mkdirSync(realDir, { recursive: true });

  const result = await runCommand(options.command);
  const stdoutFile = `${slug}.stdout.log`;
  const stderrFile = `${slug}.stderr.log`;
  const caseFile = `${slug}.case.json`;

  fs.writeFileSync(path.join(realDir, stdoutFile), result.stdout, 'utf8');
  fs.writeFileSync(path.join(realDir, stderrFile), result.stderr, 'utf8');

  const config = {
    name: options.name,
    command: options.command,
    exitCode: result.exitCode,
    stdoutFile,
    stderrFile,
    expectedReducer: options.expectedReducer,
    mustContain: options.mustContain,
    mustExpandAround: options.mustExpandAround,
    maxTokensAfter: options.maxTokensAfter,
    maxRatioPercent: options.maxRatioPercent
  };

  fs.writeFileSync(path.join(realDir, caseFile), `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  console.log(`captured: ${path.join(realDir, caseFile)}`);
  console.log(`exitCode: ${result.exitCode}`);
  console.log(`stdout bytes: ${Buffer.byteLength(result.stdout)}`);
  console.log(`stderr bytes: ${Buffer.byteLength(result.stderr)}`);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
