/**
 * Copy browser STT runtime files into vendor/ so the app can load them
 * without relying on node_modules being directly exposed by the server.
 */

import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const vendorRoot = join(projectRoot, 'vendor');

const transformersSrc = join(projectRoot, 'node_modules', '@huggingface', 'transformers', 'dist', 'transformers.web.js');
const transformersOut = join(vendorRoot, 'huggingface', 'transformers.web.js');

const onnxCommonSrc = join(projectRoot, 'node_modules', 'onnxruntime-common', 'dist', 'esm');
const onnxCommonOut = join(vendorRoot, 'onnxruntime-common', 'dist', 'esm');

const onnxWebSrc = join(projectRoot, 'node_modules', 'onnxruntime-web', 'dist', 'ort.webgpu.bundle.min.mjs');
const onnxWebOut = join(vendorRoot, 'onnxruntime-web', 'dist', 'ort.webgpu.bundle.min.mjs');

mkdirSync(dirname(transformersOut), { recursive: true });
mkdirSync(dirname(onnxCommonOut), { recursive: true });
mkdirSync(dirname(onnxWebOut), { recursive: true });

cpSync(transformersSrc, transformersOut);
cpSync(onnxCommonSrc, onnxCommonOut, { recursive: true });
cpSync(onnxWebSrc, onnxWebOut);

console.log('Copied browser STT vendor files to vendor/.');
