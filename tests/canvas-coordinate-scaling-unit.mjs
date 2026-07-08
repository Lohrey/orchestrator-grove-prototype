import assert from 'node:assert/strict';

import { canvasPoint } from '../src/utils.js';
import { installCameraSystem } from '../src/systems/camera-system.js';

const rectCanvas = {
  width: 640,
  height: 360,
  getBoundingClientRect: () => ({ left: 10, top: 20, width: 1280, height: 720 })
};

const center = canvasPoint(rectCanvas, { clientX: 650, clientY: 380 }, 640, 360);
assert.equal(center.x, 320, 'CSS-scaled center maps to logical center x');
assert.equal(center.y, 180, 'CSS-scaled center maps to logical center y');
assert.equal(center.clientX, 650, 'clientX is preserved for menu placement');
assert.equal(center.clientY, 380, 'clientY is preserved for menu placement');

const edge = canvasPoint(rectCanvas, { clientX: 1290, clientY: 740 }, 640, 360);
assert.equal(edge.x, 640, 'right edge maps to logical width');
assert.equal(edge.y, 360, 'bottom edge maps to logical height');

class TestGame {}
installCameraSystem(TestGame, {
  CAMERA_MAX_ZOOM: 2.35,
  CAMERA_MIN_ZOOM: 0.55,
  CAMERA_EDGE_VIEWPORT_PADDING_RATIO: 0.12,
  CAMERA_WHEEL_SENSITIVITY: 0.0015
});

function makeGame(parentWidth, parentHeight, renderBackend = null) {
  const canvas = {
    width: 1,
    height: 1,
    style: {},
    parentElement: {
      getBoundingClientRect: () => ({ width: parentWidth, height: parentHeight })
    },
    getBoundingClientRect: () => ({ width: parentWidth, height: parentHeight })
  };
  return Object.assign(new TestGame(), {
    canvas,
    renderBackend,
    camera: { x: 0, y: 0, zoom: 1 },
    map: { width: 3600, height: 2400 }
  });
}

let game = makeGame(1920, 1080);
game._updateIntegerScale();
assert.equal(game._integerScale, 3, '1920x1080 uses exact 3x native scale');
assert.equal(game.canvas.style.width, '1920px');
assert.equal(game.canvas.style.height, '1080px');

game = makeGame(1536, 864);
game._updateIntegerScale();
assert.equal(game._integerScale, 2, 'non-integer fullscreen fit floors to 2x');
assert.equal(game.canvas.style.width, '1280px');
assert.equal(game.canvas.style.height, '720px');

game = makeGame(500, 300);
game._updateIntegerScale();
assert.ok(game._integerScale < 1, 'small viewports downscale fractionally to fit');
assert.equal(game.canvas.style.width, '500px');
assert.equal(game.canvas.style.height, '281px');

let resizeArgs = null;
game = makeGame(1920, 1080, {
  kind: 'webgl2',
  resize(args) { resizeArgs = args; }
});
game.resizeCanvas(false);
assert.equal(game.W, 640, 'WebGL2 16:9 keeps 640 logical width');
assert.equal(game.H, 360, 'WebGL2 16:9 keeps 360 logical height');
assert.equal(game.canvas.width, 1920, 'WebGL2 1080p backing store fills displayed width');
assert.equal(game.canvas.height, 1080, 'WebGL2 1080p backing store fills displayed height');
assert.equal(game.canvas.style.width, '100%');
assert.equal(game.canvas.style.height, '100%');
assert.equal(resizeArgs.logicalWidth, 640, 'WebGL2 resize reports logical width');
assert.equal(resizeArgs.logicalHeight, 360, 'WebGL2 resize reports logical height');

game = makeGame(2560, 1080, { kind: 'webgl2', resize() {} });
game.resizeCanvas(false);
assert.equal(game.H, 360, 'WebGL2 ultrawide keeps native logical height');
assert.ok(game.W > 640, 'WebGL2 ultrawide expands logical width instead of letterboxing');
assert.equal(game.canvas.width, 2560, 'WebGL2 ultrawide backing store fills displayed width');
assert.equal(game.canvas.height, 1080, 'WebGL2 ultrawide backing store fills displayed height');

game = makeGame(1024, 768, { kind: 'webgl2', resize() {} });
game.resizeCanvas(false);
assert.equal(game.W, 640, 'WebGL2 tall viewport keeps native logical width');
assert.ok(game.H > 360, 'WebGL2 tall viewport expands logical height instead of letterboxing');
assert.equal(game.canvas.width, 1024, 'WebGL2 tall backing store fills displayed width');
assert.equal(game.canvas.height, 768, 'WebGL2 tall backing store fills displayed height');

console.log('canvas coordinate scaling unit tests passed');
