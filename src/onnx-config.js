let configured = false;

export function configureOnnxWasmPaths(env) {
  if (configured) return;
  configured = true;

  if (env?.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = '/onnx/';
  }
}
