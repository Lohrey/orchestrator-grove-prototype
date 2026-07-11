import assert from 'node:assert/strict';

import { createChatController } from '../src/chat.js';

const noop = () => {};
const listeners = new Map();
const makeTarget = () => ({
  addEventListener: (type, fn) => listeners.set(type, fn),
  dispatchEvent: event => listeners.get(event.type)?.(event),
  closest: () => null
});

globalThis.document = {
  activeElement: null,
  addEventListener: noop
};
globalThis.window = {};

const chatInput = {
  tagName: 'INPUT',
  value: 'agent mode command',
  selectionStart: 18,
  selectionEnd: 18,
  addEventListener: noop,
  dispatchEvent: noop,
  focus: noop,
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
};
const chatForm = makeTarget();
const asrStatus = {
  textContent: '',
  classList: { isError: false, toggle(name, value) { if (name === 'is-error') this.isError = Boolean(value); } }
};
let capturedError = null;
let capturedContext = null;
const submitError = new Error('agent mode provider exploded');

createChatController({
  chatInput,
  chatForm,
  asrStatus,
  onSubmit: async () => { throw submitError; },
  onError: (error, context) => { capturedError = error; capturedContext = context; }
});

await listeners.get('submit')({ preventDefault: noop, type: 'submit' });

assert.equal(chatInput.value, '', 'submitted text should be cleared exactly once');
assert.equal(asrStatus.textContent, 'Chat request failed: agent mode provider exploded');
assert.equal(asrStatus.classList.isError, true);
assert.equal(capturedError, submitError);
assert.deepEqual(capturedContext, { text: 'agent mode command' });

console.log('chat submit error unit passed');
