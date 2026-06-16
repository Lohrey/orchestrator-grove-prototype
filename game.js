import('./src/main.js?v=t_step_registry').then(({ startGame }) => startGame()).catch(err => {
  console.error('Orchestrator Grove failed to boot', err);
  const statline = document.getElementById('statline');
  if (statline) statline.textContent = `Boot error: ${err.message}`;
});
