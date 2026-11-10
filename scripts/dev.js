#!/usr/bin/env node

/**
 * ASA Studio Development Server & Watcher
 * Watches `src/` for changes, automatically compiles components & sections,
 * and runs the local server at http://localhost:3000/.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { build } = require('./build');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

let debounceTimer = null;
function triggerRebuild(event, filename) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`\n🔄 [Watch] Change detected in ${filename || 'src'}. Rebuilding...`);
    try {
      build();
    } catch (err) {
      console.error('❌ Build failed:', err.message);
    }
  }, 100);
}

// 1. Initial build
build();

// 2. Start server process
const serverProcess = spawn('node', ['scripts/server.js'], {
  cwd: ROOT_DIR,
  stdio: 'inherit'
});

serverProcess.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
});

// 3. Watch src directory
console.log(`👀 Watching for changes in: ${SRC_DIR}`);
fs.watch(SRC_DIR, { recursive: true }, (event, filename) => {
  if (filename && (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js'))) {
    triggerRebuild(event, filename);
  }
});

process.on('SIGINT', () => {
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProcess.kill();
  process.exit(0);
});
