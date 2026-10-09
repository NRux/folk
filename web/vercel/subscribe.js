const form = document.querySelector('#subscribe-form');
const subscriptionText=(key,fallback)=>(typeof window!=='undefined'?window.FolklyUI:null)?.t(key,fallback)||fallback;
if (form) form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const status = document.querySelector('#signup-status');
  button.disabled = true;
  status.textContent = subscriptionText('subscribeSaving','Saving your subscription…');
  try {
    const response = await fetch('/api/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    status.textContent = typeof window!=='undefined'&&window.FolklyUI?subscriptionText(response.ok?'subscribeSaved':response.status>=500?'subscribeUnavailable':'subscribeInvalid',result.message):result.message;
    if (response.ok) { form.reset(); window.folklyAnalytics?.emit('subscribe_success'); }
  } catch { status.textContent = subscriptionText('subscribeConnection','Could not connect. Please try again.'); }
  finally { button.disabled = false; }
});
