/* Authorized tester sign-in for staging tabs. Authorization is enforced again by each API. */
(function () {
  'use strict';
  if (window.__RRHS_STAGING_ACCESS || window.RRHS_DEPLOYMENT?.frontendEnvironment !== 'staging') return;
  window.__RRHS_STAGING_ACCESS = true;
  const deployment = window.RRHS_DEPLOYMENT;
  if (deployment.sessionToken()) return;

  const style = document.createElement('style');
  style.textContent = `.rrhs-stage-gate{border:0;padding:0;background:transparent;color:#27191a}.rrhs-stage-gate::backdrop{background:rgba(30,17,19,.68)}.rrhs-stage-card{box-sizing:border-box;width:min(92vw,430px);padding:28px;border:1px solid #d7c9bd;border-radius:8px;background:#faf8f4;box-shadow:0 18px 60px rgba(20,10,12,.24);font:16px/1.5 Georgia,serif}.rrhs-stage-card h2{margin:0 0 8px;color:#6e1f2a;font-size:25px}.rrhs-stage-card p{margin:0 0 18px}.rrhs-stage-card label{display:block;margin:14px 0 6px;font-weight:700}.rrhs-stage-card input{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;border:1px solid #8a7973;border-radius:4px;font:16px/1.2 Arial,sans-serif}.rrhs-stage-card button{min-height:44px;margin-top:18px;padding:10px 18px;border:0;border-radius:4px;background:#6e1f2a;color:#fff;font-weight:700;cursor:pointer}.rrhs-stage-card button:disabled{cursor:wait;opacity:.55}.rrhs-stage-error{min-height:24px;margin-top:10px!important;color:#9b1c28;font-family:Arial,sans-serif;font-size:14px}`;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.className = 'rrhs-stage-gate';
  dialog.innerHTML = `<form class="rrhs-stage-card" method="dialog"><h2>Staging access</h2><p>Use an approved tester email. We’ll send a six-digit code.</p><label for="rrhs-stage-email">Tester email</label><input id="rrhs-stage-email" type="email" autocomplete="email" required><div data-code hidden><label for="rrhs-stage-code">Verification code</label><input id="rrhs-stage-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div><p class="rrhs-stage-error" role="alert" aria-live="polite"></p><button type="submit">Send code</button></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const email = dialog.querySelector('#rrhs-stage-email');
  const code = dialog.querySelector('#rrhs-stage-code');
  const codeWrap = dialog.querySelector('[data-code]');
  const error = dialog.querySelector('.rrhs-stage-error');
  const button = dialog.querySelector('button');
  let challenge = '';
  dialog.addEventListener('cancel', event => event.preventDefault());
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = ''; button.disabled = true;
    try {
      const body = challenge ? { action: 'verify-code', email: email.value, code: code.value, challenge } : { action: 'send-code', email: email.value };
      const response = await deployment.fetch('/api/v1/staging-auth', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Staging sign-in is unavailable.');
      if (result.token) { deployment.setSessionToken(result.token); dialog.close(); dialog.remove(); document.dispatchEvent(new CustomEvent('rrhs:staging-authorized')); }
      else { challenge = result.challenge; codeWrap.hidden = false; button.textContent = 'Verify and continue'; code.focus(); }
    } catch (cause) { error.textContent = cause.message; (challenge ? code : email).focus(); }
    finally { button.disabled = false; }
  });
  dialog.showModal();
  email.focus();
})();
