import assert from 'node:assert/strict';

import { installDialogueSystem } from '../src/systems/dialogue-system.js';

const noop = () => {};

globalThis.window ||= {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: noop,
  removeEventListener: noop,
};

globalThis.performance ||= { now: () => Date.now() };

class StubElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.attributes = {};
    this.className = '';
    this.textContent = '';
    this.listeners = new Map();
    this.offsetWidth = 280;
    this.offsetHeight = 60;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  closest(selector) {
    const classes = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
    if (selector === '.speech-bubble__nav-btn') {
      return classes.has('speech-bubble__nav-btn') ? this : null;
    }
    if (selector === '.speech-bubble__nav-btn--prev') {
      return classes.has('speech-bubble__nav-btn--prev') ? this : null;
    }
    if (selector === '.speech-bubble__nav-btn--next') {
      return classes.has('speech-bubble__nav-btn--next') ? this : null;
    }
    return null;
  }

  dispatch(type, overrides = {}) {
    const event = {
      target: overrides.target || this,
      preventDefaultCalled: false,
      stopPropagationCalled: false,
      preventDefault() {
        this.preventDefaultCalled = true;
      },
      stopPropagation() {
        this.stopPropagationCalled = true;
      },
      ...overrides,
    };
    for (const handler of this.listeners.get(type) || []) {
      handler(event);
    }
    return event;
  }
}

globalThis.document = {
  body: new StubElement('body'),
  createElement: (tagName) => new StubElement(tagName),
};

class StubGame {
  constructor() {
    this.dom = {
      canvas: {
        parentElement: new StubElement('div'),
      },
    };
    this.player = { x: 200, y: 200, r: 13 };
  }

  worldToScreen(x, y) {
    return { x, y };
  }
}

installDialogueSystem(StubGame, {
  dialogues: [
    {
      id: 'intro',
      pages: ['Page one', 'Page two'],
      speaker: 'player',
    },
    {
      id: 'followup',
      text: 'Follow-up prompt',
      speaker: 'player',
    },
    {
      id: 'final',
      text: 'Final prompt',
      speaker: 'player',
    },
  ],
});

const game = new StubGame();

assert.equal(game.queueDialogue('intro'), true);
assert.equal(game.getDialogueState().id, 'intro');
assert.equal(game.activeDialogue.navBar.style.display, '', 'multi-page dialogue keeps controls visible');

assert.equal(game.queueDialogue('followup'), true);
assert.equal(game.queueDialogue('final'), true);
assert.equal(game.getDialogueState().pendingCount, 2, 'later quest prompts queue behind the active dialogue');

let event = game.activeDialogue.element.dispatch('contextmenu');
assert.equal(event.preventDefaultCalled, true, 'right-click suppresses the browser context menu');
assert.equal(game.getDialogueState().typewriterComplete, true, 'right-click fast-forwards the current page');

game.activeDialogue.element.dispatch('contextmenu');
assert.equal(game.getDialogueState().pageIndex, 1, 'right-click advances to the next page');

game.activeDialogue.element.dispatch('contextmenu');
game.activeDialogue.element.dispatch('contextmenu');
assert.equal(game.getDialogueState().id, 'followup', 'queued follow-up dialogue appears after the multi-page bubble closes');
assert.equal(game.getDialogueState().pendingCount, 1, 'the remaining queued prompt stays in order');
assert.equal(game.activeDialogue.navBar.style.display, 'none', 'single-page dialogue hides the page controls');

game.activeDialogue.element.dispatch('contextmenu');
game.activeDialogue.element.dispatch('contextmenu');
assert.equal(game.getDialogueState().id, 'final', 'single-page follow-up does not replace the queued final prompt');

console.log('dialogue system unit passed');
