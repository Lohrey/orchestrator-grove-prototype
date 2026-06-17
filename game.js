import('./src/main.js?v=t_pixi_worker_wasm').then(({ startGame }) => startGame()).catch(err => {
  console.error('Orchestrator Grove failed to boot', err);
  const statline = document.getElementById('statline');
  if (statline) statline.textContent = `Boot error: ${err.message}`;
});
