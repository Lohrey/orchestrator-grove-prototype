// ── WebGL2 instanced sprite batcher ──
// Based on LittleJS engineWebGL.js (MIT license) architecture.
// Single drawArraysInstanced call per batch of sprites.
//
// Usage:
//   const batcher = createWebGL2Batcher(canvas);
//   batcher.setTexture(imageBitmap);
//   batcher.drawSprite(x, y, w, h, angle, u0, v0, u1, v1, color, additive);
//   batcher.flush();

import {
  VERTEX_SHADER_SOURCE,
  FRAGMENT_SHADER_SOURCE,
  INSTANCE_FLOATS,
  INSTANCE_BYTES,
  ATTRIB_LOCATIONS
} from './shaders.js?v=t_webgl2_batcher_0628';

const MAX_BATCH = 10000; // max sprites per batch
const BATCH_BUFFER_SIZE = MAX_BATCH * INSTANCE_BYTES;

let _webgl2Supported = null;

/**
 * Feature-detect WebGL2 support.
 * @returns {boolean}
 */
export function isWebGL2Supported() {
  if (_webgl2Supported !== null) return _webgl2Supported;
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
    _webgl2Supported = !!gl;
  } catch {
    _webgl2Supported = false;
  }
  return _webgl2Supported;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile failed: ' + info);
  }
  return shader;
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * Create a WebGL2 sprite batcher.
 * @param {HTMLCanvasElement} canvas
 * @returns {object} batcher with drawSprite, flush, setTexture, clear, resize, destroy
 */
export function createWebGL2Batcher(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
  if (!gl) return null;

  const program = createProgram(gl);
  gl.useProgram(program);

  // Uniform locations
  const uViewport = gl.getUniformLocation(program, 'uViewport');
  const uCamera = gl.getUniformLocation(program, 'uCamera');
  const uZoom = gl.getUniformLocation(program, 'uZoom');
  const uTexture = gl.getUniformLocation(program, 'uTexture');

  // VAO — we use a null VAO with instanced attributes (instanced rendering with gl_VertexID)
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Instance buffer
  const instanceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, BATCH_BUFFER_SIZE, gl.DYNAMIC_DRAW);

  // Set up instanced attribute pointers
  const stride = INSTANCE_BYTES;
  let offset = 0;

  // position (vec4)
  gl.enableVertexAttribArray(ATTRIB_LOCATIONS.position);
  gl.vertexAttribPointer(ATTRIB_LOCATIONS.position, 4, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(ATTRIB_LOCATIONS.position, 1);
  offset += 16;

  // uv (vec4)
  gl.enableVertexAttribArray(ATTRIB_LOCATIONS.uv);
  gl.vertexAttribPointer(ATTRIB_LOCATIONS.uv, 4, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(ATTRIB_LOCATIONS.uv, 1);
  offset += 16;

  // color (vec4)
  gl.enableVertexAttribArray(ATTRIB_LOCATIONS.color);
  gl.vertexAttribPointer(ATTRIB_LOCATIONS.color, 4, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(ATTRIB_LOCATIONS.color, 1);
  offset += 16;

  // additive (vec4)
  gl.enableVertexAttribArray(ATTRIB_LOCATIONS.additive);
  gl.vertexAttribPointer(ATTRIB_LOCATIONS.additive, 4, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(ATTRIB_LOCATIONS.additive, 1);
  offset += 16;

  // rotation (float)
  gl.enableVertexAttribArray(ATTRIB_LOCATIONS.rotation);
  gl.vertexAttribPointer(ATTRIB_LOCATIONS.rotation, 1, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(ATTRIB_LOCATIONS.rotation, 1);

  gl.bindVertexArray(null);

  // Texture management
  let currentTexture = null;
  let textureNeedsUpload = false;
  let pendingImage = null;

  // Batch state
  const batchData = new Float32Array(MAX_BATCH * INSTANCE_FLOATS);
  let batchCount = 0;
  let currentTextureKey = null;

  // Atlas texture
  const atlasTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uTexture, 0);

  let atlasWidth = 0;
  let atlasHeight = 0;

  /**
   * Upload an atlas image (ImageBitmap, HTMLCanvasElement, etc.) as the texture.
   */
  function setAtlas(image) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    atlasWidth = image.width || 0;
    atlasHeight = image.height || 0;
  }

  /**
   * Set viewport/camera uniforms.
   */
  function setCamera(viewportW, viewportH, camX, camY, zoom) {
    gl.useProgram(program);
    gl.uniform2f(uViewport, viewportW, viewportH);
    gl.uniform2f(uCamera, camX, camY);
    gl.uniform1f(uZoom, zoom || 1);
  }

  /**
   * Add a sprite to the batch.
   * @param {number} x - world X (center)
   * @param {number} y - world Y (center)
   * @param {number} sizeX - sprite width in world units
   * @param {number} sizeY - sprite height in world units
   * @param {number} angle - rotation in radians
   * @param {number} u0 - UV left
   * @param {number} v0 - UV top
   * @param {number} u1 - UV right
   * @param {number} v1 - UV bottom
   * @param {[number,number,number,number]} color - RGBA (0-1), defaults to [1,1,1,1]
   * @param {[number,number,number,number]} additive - additive RGBA, defaults to [0,0,0,0]
   */
  function drawSprite(x, y, sizeX, sizeY, angle, u0, v0, u1, v1, color, additive) {
    if (batchCount >= MAX_BATCH) flush();
    const i = batchCount * INSTANCE_FLOATS;
    batchData[i]      = x;
    batchData[i + 1]  = y;
    batchData[i + 2]  = sizeX;
    batchData[i + 3]  = sizeY;
    batchData[i + 4]  = u0;
    batchData[i + 5]  = v0;
    batchData[i + 6]  = u1;
    batchData[i + 7]  = v1;
    batchData[i + 8]  = color ? color[0] : 1;
    batchData[i + 9]  = color ? color[1] : 1;
    batchData[i + 10] = color ? color[2] : 1;
    batchData[i + 11] = color ? color[3] : 1;
    batchData[i + 12] = additive ? additive[0] : 0;
    batchData[i + 13] = additive ? additive[1] : 0;
    batchData[i + 14] = additive ? additive[2] : 0;
    batchData[i + 15] = additive ? additive[3] : 0;
    batchData[i + 16] = angle || 0;
    batchCount++;
  }

  /**
   * Flush the batch — submit all queued sprites as a single draw call.
   */
  function flush() {
    if (batchCount === 0) return;
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, batchData.subarray(0, batchCount * INSTANCE_FLOATS));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batchCount);
    gl.bindVertexArray(null);
    batchCount = 0;
  }

  /**
   * Clear the framebuffer.
   */
  function clear() {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Resize the canvas backing store.
   */
  function resize(w, h) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /**
   * Clean up GL resources.
   */
  function destroy() {
    try {
      gl.deleteTexture(atlasTexture);
      gl.deleteBuffer(instanceBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    } catch {}
  }

  return {
    drawSprite,
    flush,
    clear,
    setAtlas,
    setCamera,
    resize,
    destroy,
    get batchCount() { return batchCount; },
    get atlasWidth() { return atlasWidth; },
    get atlasHeight() { return atlasHeight; }
  };
}

export { MAX_BATCH, BATCH_BUFFER_SIZE };
