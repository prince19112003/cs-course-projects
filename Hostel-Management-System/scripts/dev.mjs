import { createServer } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Build main and preload
await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/main/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(rootDir, 'dist/main/index.cjs'),
  external: ['electron', 'better-sqlite3'],
});

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/preload/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(rootDir, 'dist/preload/index.cjs'),
  external: ['electron'],
});

// 2. Start Vite Dev Server
const server = await createServer({
  configFile: path.join(rootDir, 'vite.config.ts'),
  server: { port: 5173 },
});
await server.listen();
console.log('Vite server started on http://localhost:5173');

// 3. Launch Electron
const electronBinary = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const electronProcess = spawn(path.join(rootDir, 'node_modules', '.bin', electronBinary), ['.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
});

electronProcess.on('close', () => {
  server.close();
  process.exit();
});
