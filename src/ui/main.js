import { mount } from 'svelte';
import ArchitectureOverlay from './ArchitectureOverlay.svelte';

const target = document.getElementById('svelteOverlayRoot');

if (target) {
  mount(ArchitectureOverlay, { target });
}
