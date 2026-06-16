const SAVE_LIBRARY_SCHEMA = 'orchestrator-grove-save-library-v2';

export const GAME_MODE_LABELS = {
  campaign: 'Campaign mode',
  test: 'Test mode',
  local_ai: 'Local vs AI',
  online_lakes: 'Online multiplayer'
};

export function normalizeGameMode(mode) {
  if (mode === 'solo') return 'test';
  if (mode === 'multiplayer' || mode === 'online' || mode === 'host') return 'online_lakes';
  if (mode === 'local-ai') return 'local_ai';
  return GAME_MODE_LABELS[mode] ? mode : 'test';
}

function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}:${Date.now().toString(36)}:${rand}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeLibrary(value) {
  const lib = value && typeof value === 'object' ? value : {};
  const slots = lib.slots && typeof lib.slots === 'object' ? lib.slots : {};
  const normalized = { schema: SAVE_LIBRARY_SCHEMA, version: 2, slots: {} };
  for (const mode of Object.keys(GAME_MODE_LABELS)) normalized.slots[mode] = [];
  for (const [rawMode, rawSlots] of Object.entries(slots)) {
    const mode = normalizeGameMode(rawMode);
    const modeSlots = Array.isArray(rawSlots) ? rawSlots : [];
    normalized.slots[mode] = normalized.slots[mode] || [];
    for (const rawSlot of modeSlots) {
      if (!rawSlot || typeof rawSlot !== 'object') continue;
      const slot = {
        id: String(rawSlot.id || uid('slot')),
        name: String(rawSlot.name || 'Autosaves').slice(0, 64),
        createdAt: rawSlot.createdAt || rawSlot.updatedAt || new Date().toISOString(),
        updatedAt: rawSlot.updatedAt || rawSlot.createdAt || new Date().toISOString(),
        saves: []
      };
      const saves = Array.isArray(rawSlot.saves) ? rawSlot.saves : [];
      for (const rawSave of saves) {
        if (!rawSave || typeof rawSave !== 'object' || !rawSave.payload) continue;
        const payloadMode = normalizeGameMode(rawSave.payload.mode || mode);
        slot.saves.push({
          id: String(rawSave.id || uid('save')),
          name: String(rawSave.name || 'Save').slice(0, 64),
          createdAt: rawSave.createdAt || rawSave.savedAt || rawSave.payload.savedAt || new Date().toISOString(),
          savedAt: rawSave.savedAt || rawSave.payload.savedAt || new Date().toISOString(),
          mode: payloadMode,
          payload: clone({ ...rawSave.payload, mode: payloadMode })
        });
      }
      slot.saves.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
      normalized.slots[mode].push(slot);
    }
    normalized.slots[mode].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  return normalized;
}

export function createSaveGameManager({ storageGet, storageSet, libraryKey, legacyKey, now = () => new Date() }) {
  function readRaw(key) {
    try { return storageGet(key); } catch { return null; }
  }
  function writeRaw(key, value) {
    try { return storageSet(key, value); } catch { return false; }
  }
  function readLibrary() {
    const raw = readRaw(libraryKey);
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    }
    const lib = normalizeLibrary(parsed);
    migrateLegacySave(lib);
    return lib;
  }
  function writeLibrary(lib) {
    return writeRaw(libraryKey, JSON.stringify(normalizeLibrary(lib)));
  }
  function migrateLegacySave(lib) {
    if (!legacyKey) return false;
    const raw = readRaw(legacyKey);
    if (!raw) return false;
    let payload = null;
    try { payload = JSON.parse(raw); } catch { return false; }
    if (!payload || payload.schema !== 'orchestrator-grove-save-v1') return false;
    const mode = normalizeGameMode(payload.mode || (payload.multiplayer?.enabled ? payload.multiplayer?.mapMode : 'test'));
    lib.slots[mode] = lib.slots[mode] || [];
    const already = lib.slots[mode].some(slot => slot.saves?.some(save => save.legacyKey === legacyKey || save.savedAt === payload.savedAt));
    if (already) return false;
    const timestamp = payload.savedAt || now().toISOString();
    lib.slots[mode].unshift({
      id: uid('slot'),
      name: 'Migrated browser save',
      createdAt: timestamp,
      updatedAt: timestamp,
      saves: [{ id: uid('save'), name: 'Imported legacy save', createdAt: timestamp, savedAt: timestamp, mode, payload: clone({ ...payload, mode }), legacyKey }]
    });
    writeLibrary(lib);
    return true;
  }
  function snapshot(mode = null) {
    const lib = readLibrary();
    const normalizedMode = mode ? normalizeGameMode(mode) : null;
    const slots = normalizedMode ? (lib.slots[normalizedMode] || []) : Object.values(lib.slots).flat();
    return clone({ schema: lib.schema, slots: normalizedMode ? { [normalizedMode]: slots } : lib.slots });
  }
  function listSlots(mode) {
    const lib = readLibrary();
    return clone(lib.slots[normalizeGameMode(mode)] || []);
  }
  function findSlot(lib, mode, slotId) {
    return (lib.slots[mode] || []).find(slot => slot.id === slotId) || null;
  }
  function latest(mode) {
    const slots = listSlots(mode);
    const saves = slots.flatMap(slot => (slot.saves || []).map(save => ({ ...save, slotId: slot.id, slotName: slot.name })));
    saves.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    return clone(saves[0] || null);
  }
  function hasSaves(mode) {
    return !!latest(mode);
  }
  function save(mode, payload, { slotId = '', slotName = '', saveName = '' } = {}) {
    const lib = readLibrary();
    const normalizedMode = normalizeGameMode(mode || payload?.mode);
    const timestamp = now().toISOString();
    lib.slots[normalizedMode] = lib.slots[normalizedMode] || [];
    let slot = slotId ? findSlot(lib, normalizedMode, slotId) : null;
    if (!slot) {
      slot = { id: uid('slot'), name: (slotName || 'Autosaves').trim().slice(0, 64), createdAt: timestamp, updatedAt: timestamp, saves: [] };
      lib.slots[normalizedMode].unshift(slot);
    }
    const namedPayload = clone({ ...payload, mode: normalizedMode, savedAt: timestamp });
    const entry = { id: uid('save'), name: (saveName || `Save ${new Date(timestamp).toLocaleString()}`).trim().slice(0, 64), createdAt: timestamp, savedAt: timestamp, mode: normalizedMode, payload: namedPayload };
    slot.saves.unshift(entry);
    slot.updatedAt = timestamp;
    lib.slots[normalizedMode].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return writeLibrary(lib) ? clone({ slot, save: entry }) : null;
  }
  function load(mode, slotId = '', saveId = '') {
    const normalizedMode = normalizeGameMode(mode);
    const lib = readLibrary();
    let candidates = [];
    for (const slot of lib.slots[normalizedMode] || []) {
      if (slotId && slot.id !== slotId) continue;
      for (const save of slot.saves || []) {
        if (saveId && save.id !== saveId) continue;
        candidates.push({ slot, save });
      }
    }
    candidates.sort((a, b) => Date.parse(b.save.savedAt) - Date.parse(a.save.savedAt));
    const found = candidates[0];
    return found ? clone({ slotId: found.slot.id, slotName: found.slot.name, save: found.save, payload: found.save.payload }) : null;
  }
  function renameSlot(mode, slotId, name) {
    const normalizedMode = normalizeGameMode(mode);
    const lib = readLibrary();
    const slot = findSlot(lib, normalizedMode, slotId);
    if (!slot) return false;
    slot.name = String(name || slot.name).trim().slice(0, 64) || slot.name;
    slot.updatedAt = now().toISOString();
    return writeLibrary(lib);
  }
  function deleteSlot(mode, slotId) {
    const normalizedMode = normalizeGameMode(mode);
    const lib = readLibrary();
    const before = (lib.slots[normalizedMode] || []).length;
    lib.slots[normalizedMode] = (lib.slots[normalizedMode] || []).filter(slot => slot.id !== slotId);
    return before !== lib.slots[normalizedMode].length && writeLibrary(lib);
  }
  function renameSave(mode, slotId, saveId, name) {
    const normalizedMode = normalizeGameMode(mode);
    const lib = readLibrary();
    const slot = findSlot(lib, normalizedMode, slotId);
    const save = slot?.saves?.find(entry => entry.id === saveId);
    if (!save) return false;
    save.name = String(name || save.name).trim().slice(0, 64) || save.name;
    slot.updatedAt = now().toISOString();
    return writeLibrary(lib);
  }
  function deleteSave(mode, slotId, saveId) {
    const normalizedMode = normalizeGameMode(mode);
    const lib = readLibrary();
    const slot = findSlot(lib, normalizedMode, slotId);
    if (!slot) return false;
    const before = slot.saves.length;
    slot.saves = slot.saves.filter(entry => entry.id !== saveId);
    slot.updatedAt = now().toISOString();
    return before !== slot.saves.length && writeLibrary(lib);
  }
  function deleteOldSaves(mode, slotId, keepNewest = 1) {
    const normalizedMode = normalizeGameMode(mode);
    const keep = Math.max(0, Number.parseInt(keepNewest, 10) || 0);
    const lib = readLibrary();
    const slot = findSlot(lib, normalizedMode, slotId);
    if (!slot) return 0;
    slot.saves.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    const removed = slot.saves.splice(keep).length;
    slot.updatedAt = now().toISOString();
    writeLibrary(lib);
    return removed;
  }
  return { snapshot, listSlots, latest, hasSaves, save, load, renameSlot, deleteSlot, renameSave, deleteSave, deleteOldSaves, normalizeGameMode };
}
