/**
 * Copy ONNX Runtime WASM assets into public/onnx so browser inference can load
 * same-origin worker and wasm files without CDN cross-origin issues.
 */

import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const onnxPackageJson = join(projectRoot, 'node_modules', 'onnxruntime-web', 'package.json');
const onnxDistDir = join(dirname(onnxPackageJson), 'dist');
const outputDir = join(projectRoot, 'public', 'onnx');

mkdirSync(outputDir, { recursive: true });

const files = [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm'
];

for (const file of files) {
  cpSync(join(onnxDistDir, file), join(outputDir, file));
}

console.log(`Copied ${files.length} ONNX WASM files to public/onnx/`);
