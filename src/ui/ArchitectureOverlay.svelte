<script>
  import { onMount } from 'svelte';

  let bridge = null;
  let simStatus = 'starting';
  let renderer = 'starting';

  function updateFromBridge(nextBridge) {
    bridge = nextBridge;
    renderer = nextBridge?.getRendererLabel?.() || 'renderer pending';
    simStatus = nextBridge?.getSimWorkerStatus?.() || 'sim worker pending';
  }

  onMount(() => {
    const onReady = event => updateFromBridge(event.detail);
    const onState = event => {
      if (event.detail?.renderer) renderer = event.detail.renderer;
      if (event.detail?.simStatus) simStatus = event.detail.simStatus;
    };
    window.addEventListener('orchestrator:ui-ready', onReady);
    window.addEventListener('orchestrator:ui-state', onState);
    if (window.orchestratorUiBridge) updateFromBridge(window.orchestratorUiBridge);
    const timer = window.setInterval(() => {
      if (window.orchestratorUiBridge) updateFromBridge(window.orchestratorUiBridge);
    }, 1000);
    return () => {
      window.removeEventListener('orchestrator:ui-ready', onReady);
      window.removeEventListener('orchestrator:ui-state', onState);
      window.clearInterval(timer);
    };
  });
</script>

{#if bridge}
  <aside class="grove-architecture-badge" aria-label="Orchestrator Grove architecture status">
    <b>Grove Architecture</b>
    <span>{renderer}</span>
    <span>{simStatus}</span>
  </aside>
{/if}

<style>
  .grove-architecture-badge {
    position: absolute;
    right: 18px;
    bottom: 18px;
    display: grid;
    gap: 2px;
    min-width: 220px;
    padding: 9px 12px;
    border: 1px solid rgba(118, 183, 127, .35);
    border-radius: 12px;
    background: rgba(10, 15, 13, .74);
    box-shadow: 0 8px 26px rgba(0, 0, 0, .28);
    color: #dce8df;
    font: 600 11px/1.35 system-ui, sans-serif;
    pointer-events: none;
    backdrop-filter: blur(8px);
  }
  .grove-architecture-badge b {
    color: #f5f0c8;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .grove-architecture-badge span {
    color: #a9cbb3;
  }
</style>
