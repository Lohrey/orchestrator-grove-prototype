const SFX_KEY = 'orchestratorGrove.audio.sfxEnabled';
const SFX_VOLUME_KEY = 'orchestratorGrove.audio.sfxVolume';
const MUSIC_VOLUME_KEY = 'orchestratorGrove.audio.musicVolume';
const MUSIC_STATION_KEY = 'orchestratorGrove.audio.musicStation';

export const COZY_RADIO_STATIONS = {
  groovesalad: {
    label: 'Groove Salad · cozy chill',
    url: 'https://ice1.somafm.com/groovesalad-64-aac',
    vibe: 'Cozy base-building downtempo',
    source: 'SomaFM free listener-supported online radio'
  },
  dronezone: {
    label: 'Drone Zone · ambient focus',
    url: 'https://ice1.somafm.com/dronezone-64-aac',
    vibe: 'Warm ambient automation flow',
    source: 'SomaFM free listener-supported online radio'
  },
  missioncontrol: {
    label: 'Mission Control · space cozy',
    url: 'https://ice1.somafm.com/missioncontrol-64-aac',
    vibe: 'NASA/space ambience for quiet crafting',
    source: 'SomaFM free listener-supported online radio'
  },
  vaporwaves: {
    label: 'Vaporwaves · retro game room',
    url: 'https://ice1.somafm.com/vaporwaves-64-aac',
    vibe: 'Retro synth/game-room mood',
    source: 'SomaFM free listener-supported online radio'
  },
  defcon: {
    label: 'DEF CON · hacker arcade',
    url: 'https://ice1.somafm.com/defcon-64-aac',
    vibe: 'Cyber/gaming energy',
    source: 'SomaFM free listener-supported online radio'
  }
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const storageGet = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const storageSet = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

export function createAudioController() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const state = {
    ctx: null,
    master: null,
    enabled: storageGet(SFX_KEY, 'true') !== 'false',
    sfxVolume: clamp(storageGet(SFX_VOLUME_KEY, '0.42'), 0, 1),
    musicVolume: clamp(storageGet(MUSIC_VOLUME_KEY, '0.28'), 0, 1),
    station: storageGet(MUSIC_STATION_KEY, 'groovesalad'),
    lastPlayed: new Map(),
    music: new Audio()
  };
  if (!COZY_RADIO_STATIONS[state.station]) state.station = 'groovesalad';
  state.music.preload = 'auto';
  state.music.loop = false;
  state.music.volume = state.musicVolume;
  state.music.crossOrigin = 'anonymous';

  function ensureContext() {
    if (!AudioContextClass) return null;
    if (!state.ctx) {
      state.ctx = new AudioContextClass();
      state.master = state.ctx.createGain();
      state.master.gain.value = state.sfxVolume;
      state.master.connect(state.ctx.destination);
    }
    if (state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
    return state.ctx;
  }

  function createNoiseBuffer(ctx, duration = 0.16) {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone(ctx, { at = 0, freq = 440, duration = 0.12, type = 'sine', gain = 0.14, endFreq = null }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(state.master);
    osc.start(t0); osc.stop(t0 + duration + 0.03);
  }

  function noise(ctx, { at = 0, duration = 0.12, gain = 0.1, filter = 900, type = 'bandpass' }) {
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = createNoiseBuffer(ctx, duration);
    f.type = type; f.frequency.value = filter; f.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(f).connect(g).connect(state.master);
    src.start(t0); src.stop(t0 + duration + 0.02);
  }

  const recipes = {
    ui_click: ctx => { tone(ctx, { freq: 640, endFreq: 840, duration: 0.055, type: 'triangle', gain: 0.06 }); },
    ui_hover: ctx => { tone(ctx, { freq: 520, endFreq: 620, duration: 0.045, type: 'triangle', gain: 0.035 }); },
    ui_error: ctx => { tone(ctx, { freq: 190, endFreq: 130, duration: 0.15, type: 'sawtooth', gain: 0.08 }); },
    menu_arrive: ctx => { [196, 294, 392, 523].forEach((freq, i) => tone(ctx, { at: i * 0.075, freq, duration: 0.18, type: 'triangle', gain: 0.045 })); noise(ctx, { at: 0.02, duration: 0.38, gain: 0.035, filter: 840, type: 'lowpass' }); },
    menu_confirm: ctx => { tone(ctx, { freq: 392, endFreq: 784, duration: 0.12, type: 'triangle', gain: 0.075 }); tone(ctx, { at: 0.09, freq: 1046, duration: 0.08, type: 'sine', gain: 0.035 }); },
    menu_back: ctx => { tone(ctx, { freq: 420, endFreq: 260, duration: 0.11, type: 'triangle', gain: 0.055 }); },
    menu_whoosh: ctx => { noise(ctx, { duration: 0.18, gain: 0.045, filter: 1200, type: 'highpass' }); tone(ctx, { at: 0.04, freq: 220, endFreq: 440, duration: 0.16, type: 'sine', gain: 0.025 }); },
    move: ctx => { noise(ctx, { duration: 0.06, gain: 0.035, filter: 420, type: 'lowpass' }); },
    build: ctx => { noise(ctx, { duration: 0.12, gain: 0.11, filter: 520 }); tone(ctx, { at: 0.06, freq: 330, duration: 0.1, type: 'triangle', gain: 0.07 }); },
    bot_online: ctx => { tone(ctx, { freq: 360, duration: 0.07, type: 'triangle', gain: 0.05 }); tone(ctx, { at: 0.07, freq: 520, duration: 0.09, type: 'triangle', gain: 0.06 }); },
    pickup: ctx => { tone(ctx, { freq: 720, endFreq: 980, duration: 0.08, type: 'triangle', gain: 0.06 }); },
    equip: ctx => { tone(ctx, { freq: 460, duration: 0.06, type: 'square', gain: 0.045 }); tone(ctx, { at: 0.05, freq: 690, duration: 0.08, type: 'triangle', gain: 0.07 }); },
    drop: ctx => { noise(ctx, { duration: 0.09, gain: 0.075, filter: 310, type: 'lowpass' }); tone(ctx, { freq: 150, duration: 0.08, type: 'sine', gain: 0.035 }); },
    deposit: ctx => { noise(ctx, { duration: 0.08, gain: 0.06, filter: 650 }); tone(ctx, { at: 0.04, freq: 410, duration: 0.08, type: 'triangle', gain: 0.045 }); },
    storage: ctx => { tone(ctx, { freq: 310, duration: 0.05, type: 'triangle', gain: 0.05 }); tone(ctx, { at: 0.045, freq: 390, duration: 0.08, type: 'triangle', gain: 0.04 }); },
    chop: ctx => { noise(ctx, { duration: 0.12, gain: 0.14, filter: 760 }); tone(ctx, { freq: 115, duration: 0.08, type: 'triangle', gain: 0.06 }); },
    mine: ctx => { tone(ctx, { freq: 160, endFreq: 92, duration: 0.09, type: 'square', gain: 0.08 }); noise(ctx, { at: 0.015, duration: 0.13, gain: 0.1, filter: 1750 }); },
    dig: ctx => { noise(ctx, { duration: 0.16, gain: 0.12, filter: 260, type: 'lowpass' }); },
    plant: ctx => { tone(ctx, { freq: 420, endFreq: 650, duration: 0.12, type: 'sine', gain: 0.06 }); noise(ctx, { at: 0.03, duration: 0.1, gain: 0.035, filter: 950 }); },
    search: ctx => { noise(ctx, { duration: 0.11, gain: 0.045, filter: 1200 }); tone(ctx, { at: 0.05, freq: 760, duration: 0.06, type: 'sine', gain: 0.035 }); },
    harvest: ctx => { noise(ctx, { duration: 0.16, gain: 0.09, filter: 980 }); tone(ctx, { at: 0.08, freq: 550, duration: 0.09, type: 'triangle', gain: 0.05 }); },
    craft_start: ctx => { tone(ctx, { freq: 260, duration: 0.09, type: 'triangle', gain: 0.05 }); noise(ctx, { at: 0.04, duration: 0.12, gain: 0.055, filter: 700 }); },
    craft_done: ctx => { tone(ctx, { freq: 500, duration: 0.07, type: 'triangle', gain: 0.06 }); tone(ctx, { at: 0.07, freq: 760, duration: 0.1, type: 'triangle', gain: 0.07 }); },
    arrow: ctx => { noise(ctx, { duration: 0.08, gain: 0.055, filter: 2100, type: 'highpass' }); tone(ctx, { freq: 980, endFreq: 500, duration: 0.08, type: 'sine', gain: 0.035 }); },
    hit: ctx => { noise(ctx, { duration: 0.09, gain: 0.09, filter: 420 }); tone(ctx, { freq: 120, duration: 0.07, type: 'triangle', gain: 0.05 }); },
    victory: ctx => { [392, 523, 659].forEach((freq, i) => tone(ctx, { at: i * 0.08, freq, duration: 0.14, type: 'triangle', gain: 0.06 })); },
    switch: ctx => { tone(ctx, { freq: 300, endFreq: 680, duration: 0.1, type: 'triangle', gain: 0.055 }); },
    demolish: ctx => { tone(ctx, { freq: 95, endFreq: 50, duration: 0.2, type: 'sine', gain: 0.1 }); noise(ctx, { duration: 0.22, gain: 0.12, filter: 380, type: 'lowpass' }); noise(ctx, { at: 0.06, duration: 0.16, gain: 0.06, filter: 1400 }); },
    night_fall: ctx => { tone(ctx, { freq: 160, endFreq: 55, duration: 0.7, type: 'sine', gain: 0.06 }); tone(ctx, { at: 0.08, freq: 82, endFreq: 41, duration: 0.65, type: 'sine', gain: 0.045 }); noise(ctx, { at: 0.04, duration: 0.55, gain: 0.03, filter: 200, type: 'lowpass' }); },
    dawn: ctx => { [392, 494, 587].forEach((freq, i) => tone(ctx, { at: i * 0.09, freq, duration: 0.28, type: 'triangle', gain: 0.05 })); tone(ctx, { at: 0.28, freq: 784, duration: 0.22, type: 'sine', gain: 0.035 }); },
    monster_spawn: ctx => { tone(ctx, { freq: 130, endFreq: 70, duration: 0.28, type: 'sawtooth', gain: 0.08 }); noise(ctx, { duration: 0.22, gain: 0.07, filter: 340, type: 'lowpass' }); tone(ctx, { at: 0.12, freq: 85, endFreq: 55, duration: 0.16, type: 'sawtooth', gain: 0.045 }); },
    player_hurt: ctx => { noise(ctx, { duration: 0.06, gain: 0.09, filter: 2600, type: 'highpass' }); tone(ctx, { at: 0.02, freq: 720, endFreq: 320, duration: 0.12, type: 'square', gain: 0.055 }); },
    bot_defeat: ctx => { [520, 390, 280, 175].forEach((freq, i) => tone(ctx, { at: i * 0.07, freq, duration: 0.12, type: 'sine', gain: 0.05 })); noise(ctx, { at: 0.02, duration: 0.2, gain: 0.03, filter: 600, type: 'lowpass' }); },
    teach_start: ctx => { tone(ctx, { freq: 660, duration: 0.07, type: 'sine', gain: 0.05 }); tone(ctx, { at: 0.07, freq: 990, duration: 0.09, type: 'sine', gain: 0.055 }); },
    teach_stop: ctx => { [523, 659, 784].forEach((freq, i) => tone(ctx, { at: i * 0.06, freq, duration: 0.1, type: 'triangle', gain: 0.045 })); },
    zone_create: ctx => { tone(ctx, { freq: 340, endFreq: 460, duration: 0.14, type: 'sine', gain: 0.05 }); noise(ctx, { at: 0.02, duration: 0.2, gain: 0.03, filter: 720 }); },
    promote: ctx => { [392, 523, 659].forEach((freq, i) => tone(ctx, { at: i * 0.06, freq, duration: 0.16, type: 'sawtooth', gain: 0.04 })); tone(ctx, { at: 0.2, freq: 784, duration: 0.14, type: 'triangle', gain: 0.04 }); },
    save: ctx => { tone(ctx, { freq: 880, duration: 0.04, type: 'square', gain: 0.04 }); tone(ctx, { at: 0.045, freq: 1320, duration: 0.05, type: 'square', gain: 0.035 }); },
    dog_bark: ctx => { noise(ctx, { duration: 0.05, gain: 0.07, filter: 1100 }); tone(ctx, { freq: 380, endFreq: 520, duration: 0.05, type: 'triangle', gain: 0.045 }); noise(ctx, { at: 0.08, duration: 0.05, gain: 0.06, filter: 1100 }); tone(ctx, { at: 0.08, freq: 360, endFreq: 480, duration: 0.05, type: 'triangle', gain: 0.04 }); },
    team_create: ctx => { [330, 392, 494].forEach(freq => tone(ctx, { freq, duration: 0.14, type: 'triangle', gain: 0.04 })); noise(ctx, { duration: 0.1, gain: 0.025, filter: 900 }); },
    level_up: ctx => { [392, 494, 587, 784].forEach((freq, i) => tone(ctx, { at: i * 0.06, freq, duration: 0.16, type: 'triangle', gain: 0.05 })); tone(ctx, { at: 0.26, freq: 1046, duration: 0.18, type: 'sine', gain: 0.03 }); },
    warn: ctx => { tone(ctx, { freq: 440, duration: 0.08, type: 'square', gain: 0.05 }); tone(ctx, { at: 0.1, freq: 440, duration: 0.08, type: 'square', gain: 0.05 }); },
    disassemble: ctx => { [440, 350, 280, 200].forEach((freq, i) => tone(ctx, { at: i * 0.05, freq, duration: 0.08, type: 'triangle', gain: 0.035 })); noise(ctx, { duration: 0.22, gain: 0.04, filter: 500, type: 'lowpass' }); }
  };

  function play(name, detail = {}) {
    if (!state.enabled) return false;
    const ctx = ensureContext();
    const recipe = recipes[name] || recipes.ui_click;
    if (!ctx || !recipe) return false;
    const key = detail.cooldownKey || name;
    const minGap = detail.minGapMs ?? 75;
    const last = state.lastPlayed.get(key) || 0;
    if (now() - last < minGap) return false;
    state.lastPlayed.set(key, now());
    state.master.gain.value = state.sfxVolume;
    recipe(ctx, detail);
    return true;
  }

  function setSfxEnabled(enabled) {
    state.enabled = !!enabled;
    storageSet(SFX_KEY, state.enabled ? 'true' : 'false');
    if (state.enabled) play('ui_click');
    return state.enabled;
  }

  function setSfxVolume(value) {
    state.sfxVolume = clamp(value, 0, 1);
    storageSet(SFX_VOLUME_KEY, state.sfxVolume);
    if (state.master) state.master.gain.value = state.sfxVolume;
    return state.sfxVolume;
  }

  function setMusicStation(stationKey = state.station) {
    const key = COZY_RADIO_STATIONS[stationKey] ? stationKey : 'groovesalad';
    state.station = key;
    storageSet(MUSIC_STATION_KEY, key);
    return COZY_RADIO_STATIONS[key];
  }

  async function startMusic(stationKey = state.station) {
    const station = setMusicStation(stationKey);
    if (state.music.dataset.stationKey !== state.station || !state.music.src) {
      state.music.pause();
      state.music.dataset.stationKey = state.station;
      state.music.src = station.url;
      state.music.load();
    }
    state.music.volume = state.musicVolume;
    await state.music.play();
    return station;
  }

  function stopMusic() {
    state.music.pause();
    state.music.removeAttribute('src');
    delete state.music.dataset.stationKey;
    state.music.load();
  }

  function setMusicVolume(value) {
    state.musicVolume = clamp(value, 0, 1);
    state.music.volume = state.musicVolume;
    storageSet(MUSIC_VOLUME_KEY, state.musicVolume);
    return state.musicVolume;
  }

  return {
    state,
    stations: COZY_RADIO_STATIONS,
    play,
    setSfxEnabled,
    setSfxVolume,
    startMusic,
    stopMusic,
    setMusicStation,
    setMusicVolume,
    isMusicPlaying: () => !state.music.paused && !!state.music.src
  };
}
