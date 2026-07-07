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

function makeGame(parentWidth, parentHeight) {
  const canvas = {
    style: {},
    parentElement: {
      getBoundingClientRect: () => ({ width: parentWidth, height: parentHeight })
    },
    getBoundingClientRect: () => ({ width: parentWidth, height: parentHeight })
  };
  return Object.assign(new TestGame(), { canvas });
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

console.log('canvas coordinate scaling unit tests passed');
