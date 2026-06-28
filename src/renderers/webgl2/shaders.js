// ── WebGL2 shader source strings for the sprite batcher ──
// Based on LittleJS engineWebGL.js (MIT license) architecture.

// Per-instance data layout (68 bytes → padded to 16-byte aligned = 80 bytes):
//   position: vec4  (x, y, sizeX, sizeY)     — 16 bytes
//   uv:       vec4  (u0, v0, u1, v1)        — 16 bytes
//   color:    vec4  (r, g, b, a)            — 16 bytes
//   additive: vec4  (r, g, b, a)            — 16 bytes
//   rotation: float (angle in radians)       — 4 bytes + 12 bytes padding

export const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

// Instanced per-sprite attributes
layout(location = 0) in vec4 aPosition;   // x, y, sizeX, sizeY (world space)
layout(location = 1) in vec4 aUv;         // u0, v0, u1, v1
layout(location = 2) in vec4 aColor;      // r, g, b, a (0-1)
layout(location = 3) in vec4 aAdditive;   // additive r, g, b, a (0-1)
layout(location = 4) in float aRotation;  // rotation in radians

// Uniforms
uniform vec2 uViewport;   // canvas width, height
uniform vec2 uCamera;     // camera offset x, y
uniform float uZoom;      // camera zoom

// Outputs to fragment shader
out vec2 vUv;
out vec4 vColor;
out vec4 vAdditive;

void main() {
  // Unit quad corners (0,0) to (1,1)
  vec2 corner = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);

  // Apply rotation around center
  vec2 centered = corner - vec2(0.5);
  float c = cos(aRotation);
  float s = sin(aRotation);
  vec2 rotated = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
  vec2 quad = rotated + vec2(0.5);

  // World position
  vec2 worldPos = aPosition.xy + quad * aPosition.zw;

  // World-to-screen transform
  vec2 screenPos = (worldPos - uCamera) * uZoom;

  // Screen-to-clip space (NDC)
  vec2 ndc = (screenPos / uViewport) * 2.0 - 1.0;
  ndc.y = -ndc.y; // flip Y (canvas origin is top-left)

  gl_Position = vec4(ndc, 0.0, 1.0);

  // Interpolate UVs across the quad
  vUv = mix(aUv.xy, aUv.zw, corner);
  vColor = aColor;
  vAdditive = aAdditive;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uTexture;

in vec2 vUv;
in vec4 vColor;
in vec4 vAdditive;

out vec4 fragColor;

void main() {
  vec4 texColor = texture(uTexture, vUv);
  fragColor = texColor * vColor + vAdditive;
}
`;

// Per-instance stride: 5 floats * vec4 components
// We use 5 attributes: position(4f), uv(4f), color(4f), additive(4f), rotation(1f)
// Total = 17 floats = 68 bytes
export const INSTANCE_FLOATS = 17;
export const INSTANCE_BYTES = INSTANCE_FLOATS * 4; // 68

// Attribute locations
export const ATTRIB_LOCATIONS = {
  position: 0,
  uv: 1,
  color: 2,
  additive: 3,
  rotation: 4
};
