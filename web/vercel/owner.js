const status = document.getElementById('owner-status');
async function send(body) {
  const response = await fetch('/api/owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); status.textContent = data.message;
  if (response.ok) await loadStatus();
}
async function loadStatus() {
  const response = await fetch('/api/owner', { cache: 'no-store' });
  const data = await response.json();
  document.getElementById('owner-settings').textContent = data.owner ? JSON.stringify(data.settings, null, 2) : '';
}
document.getElementById('owner-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await send({ action: event.submitter.value, email: document.getElementById('owner-email').value, code: document.getElementById('owner-code').value }); } catch { status.textContent = 'Connection unavailable. Please try again.'; }
});
document.getElementById('owner-logout').addEventListener('click', async () => {
  try { await send({ action: 'logout' }); } catch { status.textContent = 'Sign-out could not be confirmed. Please try again.'; }
});
loadStatus().catch(() => { status.textContent = 'Connection unavailable.'; });
