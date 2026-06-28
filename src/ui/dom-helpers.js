// src/ui/dom-helpers.js — pure DOM/utility helpers extracted from startGame() closure.
// v=ui_fix_boot_0628

export function createDomHelpers() {
  const $ = id => document.getElementById(id);

  const storageGet = key => {
    try { return localStorage.getItem(key); } catch { return null; }
  };

  const storageSet = (key, value) => {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  };

  const readJson = (key, fallback = null) => {
    const raw = storageGet(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };

  function formatRendererStatus(backendText, probe = null) {
    const backend = String(backendText || 'Renderer').trim();
    if (!probe) return backend;
    const probeText = String(probe.text || '').trim();
    return probeText ? `${backend} · ${probeText}` : backend;
  }

  function stringifyLog(value) {
    try { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
    catch { return String(value); }
  }

  function parseJsonPreview(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    try { return JSON.parse(trimmed); }
    catch { return value; }
  }

  return {
    $,
    storageGet,
    storageSet,
    readJson,
    formatRendererStatus,
    stringifyLog,
    parseJsonPreview
  };
}
