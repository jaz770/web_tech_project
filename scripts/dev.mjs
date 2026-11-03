import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = spawn(process.execPath, ['server/index.js'], { cwd: root, stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit' });
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  vite.kill();
  process.exitCode = code;
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
api.on('error', (error) => { console.error(error); stop(1); });
vite.on('error', (error) => { console.error(error); stop(1); });
api.on('exit', (code) => { if (!stopping) stop(code || 1); });
vite.on('exit', (code) => { if (!stopping) stop(code || 1); });
