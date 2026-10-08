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
  const action = event.submitter?.value || 'login';
  const code = document.getElementById('owner-code').value.trim();
  if (action === 'verify' && !/^\d{6,10}$/.test(code)) {
    status.textContent = 'Enter the sign-in code from your email first.';
    document.getElementById('owner-code').focus();
    return;
  }
  const buttons = [...event.currentTarget.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  try { await send({ action, email: document.getElementById('owner-email').value, code }); } catch { status.textContent = 'Connection unavailable. Please try again.'; }
  finally { buttons.forEach(button => { button.disabled = false; }); }
});
document.getElementById('owner-logout').addEventListener('click', async () => {
  try { await send({ action: 'logout' }); } catch { status.textContent = 'Sign-out could not be confirmed. Please try again.'; }
});
loadStatus().catch(() => { status.textContent = 'Connection unavailable.'; });
