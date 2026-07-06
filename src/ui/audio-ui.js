/**
 * Audio UI — radio widget, SFX controls, music station selector.
 * Extracted from main.js for modularity. All deps injected via factory.
 *
 * Usage: const audioUi = createAudioUi({ dom, audio, escapeHtml });
 *        audioUi.init(); audioUi.sync(message);
 */

export function createAudioUi({ dom, audio, escapeHtml }) {
  function setWidgetRosterOpen(open) {
    dom.widgetRoster?.classList.toggle('is-roster-open', !!open);
    dom.widgetRosterHandle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setRadioWidgetOpen(open) {
    if (!dom.radioWidgetPanel || !dom.radioWidgetToggle) return;
    dom.radioWidgetPanel.hidden = !open;
    dom.radioWidgetToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    dom.widgetRoster?.classList.toggle('has-open-widget', open);
    dom.widgetRosterHandle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setWidgetRosterOpen(true);
  }

  function syncAudioUi(message = '') {
    if (dom.audioSfxToggle) dom.audioSfxToggle.checked = audio.state.enabled;
    if (dom.audioSfxVolume) dom.audioSfxVolume.value = String(audio.state.sfxVolume);
    if (dom.audioMusicVolume) dom.audioMusicVolume.value = String(audio.state.musicVolume);
    if (dom.radioStationButtons) {
      dom.radioStationButtons.querySelectorAll('[data-radio-station]').forEach(button => {
        const selected = button.dataset.radioStation === audio.state.station;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }
    if (dom.audioMusicStatus) {
      const station = audio.stations[audio.state.station];
      const playing = audio.isMusicPlaying();
      dom.audioMusicStatus.textContent = message || `${playing ? 'Playing' : 'Selected'} ${station?.label || audio.state.station}. ${playing ? '' : 'Press Play to start.'}`;
    }
  }

  function initAudioUi() {
    if (dom.radioStationButtons) {
      dom.radioStationButtons.innerHTML = Object.entries(audio.stations).map(([id, station]) => `
        <button type="button" class="radio-station-button" data-radio-station="${escapeHtml(id)}" aria-pressed="false">
          <b>${escapeHtml(station.label)}</b>
          <small>${escapeHtml(station.vibe || station.source || '')}</small>
        </button>
      `).join('');
    }
    syncAudioUi();
    dom.audioSfxToggle?.addEventListener('change', () => syncAudioUi(audio.setSfxEnabled(dom.audioSfxToggle.checked) ? 'Sound effects enabled.' : 'Sound effects muted.'));
    dom.audioSfxVolume?.addEventListener('input', () => { audio.setSfxVolume(dom.audioSfxVolume.value); syncAudioUi(); });
    dom.audioSfxTest?.addEventListener('click', () => { audio.play('craft_done', { cooldownKey: 'ui_test', minGapMs: 0 }); syncAudioUi('Played generated test chime.'); });
    const openWidgetRoster = event => {
      event?.preventDefault?.();
      setWidgetRosterOpen(true);
    };
    dom.widgetRosterHandle?.addEventListener('pointerenter', openWidgetRoster);
    dom.widgetRosterHandle?.addEventListener('pointerdown', openWidgetRoster);
    dom.widgetRosterHandle?.addEventListener('click', openWidgetRoster);
    dom.widgetRoster?.addEventListener('pointerenter', () => setWidgetRosterOpen(true));
    dom.radioWidgetToggle?.addEventListener('mouseenter', () => audio.play('ui_hover', { cooldownKey: 'radio:hover-toggle', minGapMs: 140 }));
    dom.radioWidgetToggle?.addEventListener('click', () => { audio.play('ui_click', { cooldownKey: 'radio:toggle', minGapMs: 0 }); setRadioWidgetOpen(dom.radioWidgetPanel?.hidden !== false); });
    dom.widgetRoster?.addEventListener('mouseleave', () => { if (dom.radioWidgetPanel?.hidden) { setWidgetRosterOpen(false); audio.play('ui_hover', { cooldownKey: 'radio:hover-roster', minGapMs: 260 }); } });
    dom.radioStationButtons?.addEventListener('mouseover', e => { if (e.target.closest('[data-radio-station]')) audio.play('ui_hover', { cooldownKey: 'radio:hover-station', minGapMs: 120 }); });
    dom.radioStationButtons?.addEventListener('click', async e => {
      const button = e.target.closest('[data-radio-station]');
      if (!button) return;
      audio.play('switch', { cooldownKey: 'radio:station', minGapMs: 0 });
      const station = audio.setMusicStation(button.dataset.radioStation);
      syncAudioUi(`Selected ${station.label}.`);
      if (audio.isMusicPlaying()) {
        try {
          const started = await audio.startMusic(button.dataset.radioStation);
          syncAudioUi(`Playing ${started.label}. Low-bandwidth AAC stream.`);
        } catch (err) {
          syncAudioUi(`Could not switch radio: ${err.message}`);
        }
      }
    });
    dom.audioMusicVolume?.addEventListener('input', () => { audio.setMusicVolume(dom.audioMusicVolume.value); syncAudioUi(); });
    dom.audioMusicStart?.addEventListener('mouseenter', () => audio.play('ui_hover', { cooldownKey: 'radio:hover-play', minGapMs: 120 }));
    dom.audioMusicStop?.addEventListener('mouseenter', () => audio.play('ui_hover', { cooldownKey: 'radio:hover-stop', minGapMs: 120 }));
    dom.audioMusicStart?.addEventListener('click', async () => {
      audio.play('ui_click', { cooldownKey: 'radio:play', minGapMs: 0 });
      try {
        const station = await audio.startMusic(audio.state.station);
        syncAudioUi(`Playing ${station.label}. Low-bandwidth AAC stream.`);
      } catch (err) {
        syncAudioUi(`Could not start radio: ${err.message}`);
      }
    });
    dom.audioMusicStop?.addEventListener('click', () => { audio.play('ui_click', { cooldownKey: 'radio:stop', minGapMs: 0 }); audio.stopMusic(); syncAudioUi('Cozy radio stopped.'); });
    audio.state.music.addEventListener('waiting', () => syncAudioUi('Radio buffering… trying to keep the stream warm.'));
    audio.state.music.addEventListener('playing', () => syncAudioUi());
    audio.state.music.addEventListener('stalled', () => syncAudioUi('Radio stream stalled. Try another low-bandwidth station.'));
    audio.state.music.addEventListener('error', () => syncAudioUi('Radio stream error. Pick another station or press Play again.'));
  }

  return { init: initAudioUi, sync: syncAudioUi, setRadioWidgetOpen, setWidgetRosterOpen };
}
