// src/ui/fullscreen-ui.js — fullscreen toggle helpers.
// v=t_ui_refactor_0627

export function createFullscreenUi({ dom }) {
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  function syncFullscreenUi(message = '') {
    const active = !!fullscreenElement();
    if (dom.fullscreenToggleBtn) dom.fullscreenToggleBtn.textContent = active ? 'Exit fullscreen' : 'Enter fullscreen';
    if (dom.fullscreenStatus) dom.fullscreenStatus.textContent = message || `Fullscreen is ${active ? 'on' : 'off'}.`;
    return active;
  }

  async function toggleFullscreen() {
    const active = !!fullscreenElement();
    try {
      if (active) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        const root = document.documentElement;
        if (root.requestFullscreen) await root.requestFullscreen();
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        else {
          syncFullscreenUi('Fullscreen is not supported by this browser.');
          return false;
        }
      }
      return syncFullscreenUi();
    } catch (err) {
      syncFullscreenUi(`Fullscreen failed: ${err.message || 'browser denied the request'}.`);
      return active;
    }
  }

  return {
    fullscreenElement,
    syncFullscreenUi,
    toggleFullscreen
  };
}
