import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/preload/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(rootDir, 'dist/preload/index.cjs'),
  external: ['electron'],
  sourcemap: false,
  minify: false,
});
console.log('Preload script built successfully.');
