import('./src/main.js?v=t_91fd08d9').then(({ startGame }) => startGame()).catch(err => {
  console.error('Orchestrator Grove failed to boot', err);
  const statline = document.getElementById('statline');
  if (statline) statline.textContent = `Boot error: ${err.message}`;
});
