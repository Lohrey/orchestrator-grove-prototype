import('./src/main.js?v=t_f62dde4d_modes').then(({ startGame }) => startGame()).catch(err => {
  console.error('Orchestrator Grove failed to boot', err);
  const statline = document.getElementById('statline');
  if (statline) statline.textContent = `Boot error: ${err.message}`;
});
