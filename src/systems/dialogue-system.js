// src/systems/dialogue-system.js
// Speech bubble dialogue system for the Orchestrator Grove campaign character.
// Shows a DOM-overlay speech bubble above the player with a typewriter text reveal.
// Supports multi-page dialogues with prev/next navigation arrows.
// Installed via installDialogueSystem(Game, deps).
//
// Dependencies (passed via deps):
//   dialogues — array of dialogue entries [{id, text|pages, speaker?, trigger?}, ...]
//     text can be a string (single page) or array of strings (multi-page)
//
// Public API (on Game.prototype):
//   triggerDialogue(idOrEntry) — show a speech bubble; accepts an id string or entry object
//   queueDialogue(idOrEntry)    — show immediately or queue behind the active speech bubble
//   advanceDialogue()          — fast-forward typewriter, or next page, or dismiss if last page
//   previousDialoguePage()     — go back to previous page
//   dismissDialogue()          — remove the active speech bubble
//   updateDialogue()           — per-frame: position, typewriter (call from update loop)
//   getDialogueState()         — snapshot for testing/debugging

const TYPEWRITER_MS_PER_CHAR = 30;
const BUBBLE_OFFSET_PX = 52;

export function installDialogueSystem(Game, deps = {}) {
  const entries = Array.isArray(deps.dialogues) ? deps.dialogues : [];
  const lookup = {};
  for (const e of entries) {
    if (e && e.id) lookup[e.id] = e;
  }

  Object.assign(Game.prototype, {
    /**
     * Show a speech bubble above the player.
     * @param {string|object} idOrEntry — dialogue id string (looked up in dialogues) or {id, text|pages, speaker?}
     * @returns {boolean} true if dialogue was shown
     */
    triggerDialogue(idOrEntry) {
      let entry = idOrEntry;
      if (typeof idOrEntry === 'string') {
        entry = lookup[idOrEntry];
      }
      if (!entry) return false;

      // Normalize text into pages array
      let pages;
      if (Array.isArray(entry.pages)) {
        pages = entry.pages.map(p => String(p));
      } else if (Array.isArray(entry.text)) {
        pages = entry.text.map(p => String(p));
      } else if (entry.text) {
        pages = [String(entry.text)];
      } else {
        return false;
      }
      if (pages.length === 0) return false;

      // Remove any existing bubble first
      if (this.activeDialogue) this._removeDialogueElement();

      const now = performance.now();

      // Build DOM bubble
      const bubble = document.createElement('div');
      bubble.className = 'speech-bubble';
      bubble.setAttribute('role', 'dialog');
      bubble.setAttribute('aria-label', pages.join(' '));

      const textEl = document.createElement('span');
      textEl.className = 'speech-bubble__text';
      bubble.appendChild(textEl);

      // Navigation bar (prev/next arrows + page indicator)
      const navBar = document.createElement('div');
      navBar.className = 'speech-bubble__nav';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'speech-bubble__nav-btn speech-bubble__nav-btn--prev';
      prevBtn.setAttribute('aria-label', 'Previous page');
      prevBtn.textContent = '◀';
      const handlePrev = (ev) => {
        ev.preventDefault?.();
        ev.stopPropagation();
        this.previousDialoguePage();
      };
      prevBtn.addEventListener('click', handlePrev);
      prevBtn.addEventListener('contextmenu', handlePrev);

      const pageIndicator = document.createElement('span');
      pageIndicator.className = 'speech-bubble__nav-pages';

      const nextBtn = document.createElement('button');
      nextBtn.className = 'speech-bubble__nav-btn speech-bubble__nav-btn--next';
      nextBtn.setAttribute('aria-label', 'Next page or dismiss');
      nextBtn.textContent = '▶';
      const handleNext = (ev) => {
        ev.preventDefault?.();
        ev.stopPropagation();
        this.advanceDialogue();
      };
      nextBtn.addEventListener('click', handleNext);
      nextBtn.addEventListener('contextmenu', handleNext);

      navBar.appendChild(prevBtn);
      navBar.appendChild(pageIndicator);
      navBar.appendChild(nextBtn);
      bubble.appendChild(navBar);

      // Click anywhere on the bubble body (not nav buttons) to advance
      const handleAdvance = (ev) => {
        if (ev.target.closest('.speech-bubble__nav-btn')) return;
        ev.preventDefault?.();
        ev.stopPropagation();
        this.advanceDialogue();
      };
      bubble.addEventListener('click', handleAdvance);
      bubble.addEventListener('contextmenu', handleAdvance);

      const parent = this.dom?.canvas?.parentElement || document.body;
      parent.appendChild(bubble);

      this.activeDialogue = {
        id: entry.id || null,
        pages,
        pageIndex: 0,
        speaker: entry.speaker || 'player',
        trigger: entry.trigger || null,
        element: bubble,
        textEl,
        navBar,
        prevBtn,
        nextBtn,
        pageIndicator,
        revealedChars: 0,
        startTime: now,
        typewriterComplete: false,
      };
      this._renderDialoguePage();
      return true;
    },

    /**
     * Show a speech bubble immediately when none is active, otherwise queue it.
     * @param {string|object} idOrEntry
     * @returns {boolean} true if the dialogue was shown or queued
     */
    queueDialogue(idOrEntry) {
      if (this.activeDialogue) {
        if (!Array.isArray(this.pendingDialogues)) this.pendingDialogues = [];
        this.pendingDialogues.push(idOrEntry);
        return true;
      }
      return this.triggerDialogue(idOrEntry);
    },

    _takeQueuedDialogue() {
      if (Array.isArray(this.pendingDialogues) && this.pendingDialogues.length > 0) {
        return this.pendingDialogues.shift();
      }
      if (this.pendingDialogueId) {
        const pending = this.pendingDialogueId;
        this.pendingDialogueId = null;
        return pending;
      }
      return null;
    },

    /** Render the current page text and update nav button states. */
    _renderDialoguePage() {
      const d = this.activeDialogue;
      if (!d) return;
      const text = d.pages[d.pageIndex] || '';
      d.revealedChars = 0;
      d.typewriterComplete = false;
      d.startTime = performance.now();
      d.textEl.textContent = '';

      // Update nav visibility
      const multiPage = d.pages.length > 1;
      d.navBar.style.display = multiPage ? '' : 'none';
      if (multiPage) {
        d.pageIndicator.textContent = `${d.pageIndex + 1} / ${d.pages.length}`;
        d.prevBtn.disabled = d.pageIndex === 0;
        d.prevBtn.style.opacity = d.pageIndex === 0 ? '0.3' : '';
        // Next button shows ▶ on middle pages, ✓ on last page
        d.nextBtn.textContent = d.pageIndex === d.pages.length - 1 ? '✓' : '▶';
      }
    },

    /**
     * If typewriter is still revealing, fast-forward to full text.
     * If multi-page and not last page, go to next page.
     * Otherwise dismiss the dialogue.
     */
    advanceDialogue() {
      const d = this.activeDialogue;
      if (!d) return false;
      if (!d.typewriterComplete) {
        d.revealedChars = d.pages[d.pageIndex].length;
        d.textEl.textContent = d.pages[d.pageIndex];
        d.typewriterComplete = true;
        return true;
      }
      // Multi-page: advance to next page
      if (d.pageIndex < d.pages.length - 1) {
        d.pageIndex++;
        this._renderDialoguePage();
        return true;
      }
      return this.dismissDialogue();
    },

    /** Go to previous page (only if multi-page). */
    previousDialoguePage() {
      const d = this.activeDialogue;
      if (!d || d.pageIndex <= 0) return false;
      d.pageIndex--;
      this._renderDialoguePage();
      return true;
    },

    /** Remove the active speech bubble immediately. */
    dismissDialogue() {
      if (!this.activeDialogue) {
        const pending = this._takeQueuedDialogue();
        if (pending) return this.triggerDialogue(pending);
        return false;
      }
      this._removeDialogueElement();
      this.activeDialogue = null;
      const pending = this._takeQueuedDialogue();
      if (pending) this.triggerDialogue(pending);
      return true;
    },

    _removeDialogueElement() {
      const el = this.activeDialogue?.element;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    },

    /**
     * Per-frame update — call from the main update loop.
     * Handles typewriter reveal and bubble position tracking.
     * NO auto-dismiss — player must click to advance/dismiss.
     */
    updateDialogue() {
      const d = this.activeDialogue;
      if (!d || !d.element) return;

      // Typewriter reveal
      if (!d.typewriterComplete) {
        const now = performance.now();
        const elapsed = now - d.startTime;
        const fullText = d.pages[d.pageIndex] || '';
        const target = Math.min(fullText.length, Math.floor(elapsed / TYPEWRITER_MS_PER_CHAR));
        if (target > d.revealedChars) {
          d.revealedChars = target;
          d.textEl.textContent = fullText.slice(0, target);
        }
        if (target >= fullText.length) d.typewriterComplete = true;
      }

      // Position the bubble above the player's screen position
      const p = this.player;
      if (!p) return;
      const screen = this.worldToScreen(p.x, p.y - (p.r || 13) - BUBBLE_OFFSET_PX);
      const bw = d.element.offsetWidth || 280;
      const bh = d.element.offsetHeight || 60;
      const pad = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.max(bw / 2 + pad, Math.min(screen.x, vw - bw / 2 - pad));
      const y = Math.max(bh + pad, Math.min(screen.y, vh - pad));
      d.element.style.left = `${x}px`;
      d.element.style.top = `${y}px`;
    },

    /** Snapshot of dialogue state for testing/debugging. */
    getDialogueState() {
      if (!this.activeDialogue) {
        return {
          active: false,
          id: null,
          speaker: null,
          text: '',
          revealedText: '',
          typewriterComplete: false,
          pageIndex: 0,
          pageCount: 0,
          pendingCount: Array.isArray(this.pendingDialogues) ? this.pendingDialogues.length : 0,
        };
      }
      const d = this.activeDialogue;
      return {
        active: true,
        id: d.id,
        speaker: d.speaker,
        text: d.pages[d.pageIndex] || '',
        revealedText: d.textEl?.textContent || '',
        typewriterComplete: !!d.typewriterComplete,
        pageIndex: d.pageIndex,
        pageCount: d.pages.length,
        pendingCount: Array.isArray(this.pendingDialogues) ? this.pendingDialogues.length : 0,
      };
    },
  });
}
