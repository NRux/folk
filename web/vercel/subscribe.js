const form = document.querySelector('#subscribe-form');
if (form) form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const status = document.querySelector('#signup-status');
  button.disabled = true;
  status.textContent = 'Saving your subscription…';
  try {
    const response = await fetch('/api/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    status.textContent = result.message;
    if (response.ok) form.reset();
  } catch { status.textContent = 'Could not connect. Please try again.'; }
  finally { button.disabled = false; }
});
