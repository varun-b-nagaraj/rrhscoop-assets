/* Staging password gate (ADR 0011). Every staging API checks the session again on the server. */
(function () {
  'use strict';
  if (window.__RRHS_STAGING_ACCESS || window.RRHS_DEPLOYMENT?.frontendEnvironment !== 'staging') return;
  window.__RRHS_STAGING_ACCESS = true;
  const deployment = window.RRHS_DEPLOYMENT;
  const AUDIENCE = 'rrhs-staging-api-v2';

  // A stored session is reused only while it is current; the server still verifies its signature.
  function sessionIsCurrent(token) {
    try {
      const data = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
      return data.aud === AUDIENCE && data.exp * 1000 > Date.now() + 60000;
    } catch (_) { return false; }
  }
  const stored = deployment.sessionToken();
  if (stored && sessionIsCurrent(stored)) return;
  if (stored) deployment.setSessionToken('');

  const style = document.createElement('style');
  style.textContent = `
.rrhs-gate{--gate-brand:#6e1f2a;--gate-brand-strong:#561620;--gate-surface:#faf8f4;--gate-ink:#27191a;--gate-muted:#5c4b47;--gate-line:#8a7973;--gate-error:#9b1c28;--gate-focus:#b8860b;
  border:0;padding:0;background:transparent;color:var(--gate-ink);max-width:none;max-height:none;overflow:visible}
.rrhs-gate::backdrop{background:rgba(30,17,19,.6)}
.rrhs-gate-card{box-sizing:border-box;width:min(calc(100vw - 32px),400px);padding:28px 24px 24px;border-radius:10px;background:var(--gate-surface);
  box-shadow:0 24px 64px rgba(20,10,12,.32);font:16px/1.5 Arial,Helvetica,sans-serif;animation:rrhs-gate-in .2s ease-out}
.rrhs-gate-tag{display:inline-block;margin:0 0 12px;padding:2px 10px;border-radius:999px;background:var(--gate-brand);color:#fff;font:700 12px/20px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.rrhs-gate-card h2{margin:0 0 6px;color:var(--gate-brand);font:700 24px/1.25 Georgia,'Times New Roman',serif}
.rrhs-gate-card p{margin:0 0 20px;color:var(--gate-muted)}
.rrhs-gate-card label{display:block;margin:0 0 6px;font-weight:700}
.rrhs-gate-field{display:flex;align-items:stretch;border:1px solid var(--gate-line);border-radius:6px;background:#fff}
.rrhs-gate-field:focus-within{outline:3px solid var(--gate-focus);outline-offset:2px}
.rrhs-gate-field[data-invalid]{border-color:var(--gate-error)}
.rrhs-gate-field input{flex:1;min-width:0;min-height:44px;padding:10px 12px;border:0;border-radius:6px;background:transparent;color:var(--gate-ink);font:16px/1.2 Arial,sans-serif;outline:none}
.rrhs-gate-toggle{display:grid;place-items:center;width:48px;min-height:44px;border:0;border-left:1px solid #e3d8cf;border-radius:0 6px 6px 0;background:transparent;color:var(--gate-muted);cursor:pointer}
.rrhs-gate-toggle:focus-visible{outline:3px solid var(--gate-focus);outline-offset:-3px}
.rrhs-gate-toggle svg{width:22px;height:22px}
.rrhs-gate-error{min-height:22px;margin:8px 0 0!important;color:var(--gate-error)!important;font-size:14px}
.rrhs-gate-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:16px}
.rrhs-gate-submit{min-height:44px;min-width:140px;padding:10px 20px;border:0;border-radius:6px;background:var(--gate-brand);color:#fff;font:700 16px/1 Arial,sans-serif;cursor:pointer;transition:background-color .15s ease-out}
.rrhs-gate-submit:hover{background:var(--gate-brand-strong)}
.rrhs-gate-submit:focus-visible{outline:3px solid var(--gate-focus);outline-offset:2px}
.rrhs-gate-submit:disabled{cursor:progress;opacity:.6}
.rrhs-gate-leave{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;color:var(--gate-brand);font-size:14px;text-decoration:underline;text-underline-offset:3px}
.rrhs-gate-leave:focus-visible{outline:3px solid var(--gate-focus);outline-offset:2px;border-radius:4px}
@keyframes rrhs-gate-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rrhs-gate-card{animation:none}.rrhs-gate-submit{transition:none}}`;
  document.head.append(style);

  const eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  const leaveUrl = new URL(location.href);
  leaveUrl.searchParams.set('rrhs_env', 'prod');

  const dialog = document.createElement('dialog');
  dialog.className = 'rrhs-gate';
  dialog.setAttribute('aria-labelledby', 'rrhs-gate-title');
  dialog.setAttribute('aria-describedby', 'rrhs-gate-help');
  dialog.innerHTML = `<form class="rrhs-gate-card" novalidate>
<span class="rrhs-gate-tag">Staging</span>
<h2 id="rrhs-gate-title">Enter the staging password</h2>
<p id="rrhs-gate-help">This tab runs the staging build. Real orders, coupons and emails still happen here.</p>
<label for="rrhs-gate-password">Password</label>
<div class="rrhs-gate-field">
<input id="rrhs-gate-password" name="password" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" required aria-describedby="rrhs-gate-error">
<button class="rrhs-gate-toggle" type="button" aria-label="Show password" aria-pressed="false">${eye}</button>
</div>
<p class="rrhs-gate-error" id="rrhs-gate-error" role="alert" aria-live="assertive"></p>
<div class="rrhs-gate-actions">
<a class="rrhs-gate-leave" href="${leaveUrl.href.replace(/"/g, '&quot;')}">Leave staging</a>
<button class="rrhs-gate-submit" type="submit">Continue</button>
</div>
</form>`;
  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const input = dialog.querySelector('#rrhs-gate-password');
  const field = dialog.querySelector('.rrhs-gate-field');
  const toggle = dialog.querySelector('.rrhs-gate-toggle');
  const error = dialog.querySelector('.rrhs-gate-error');
  const submit = dialog.querySelector('.rrhs-gate-submit');

  // The gate cannot be dismissed with Escape; "Leave staging" is the way out.
  dialog.addEventListener('cancel', event => event.preventDefault());
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    toggle.innerHTML = show ? eyeOff : eye;
    input.focus();
  });
  input.addEventListener('input', () => { if (error.textContent) { error.textContent = ''; field.removeAttribute('data-invalid'); input.removeAttribute('aria-invalid'); } });

  function showError(message) {
    error.textContent = message;
    field.setAttribute('data-invalid', '');
    input.setAttribute('aria-invalid', 'true');
    input.select();
    input.focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!input.value) return showError('Enter the staging password.');
    submit.disabled = true;
    submit.textContent = 'Checking…';
    try {
      const response = await deployment.fetch('/api/v1/staging-auth', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-in', password: input.value }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) throw new Error(result.error || 'Staging sign-in is unavailable. Try again in a minute.');
      deployment.setSessionToken(result.token);
      input.value = '';
      dialog.close();
      dialog.remove();
      document.dispatchEvent(new CustomEvent('rrhs:staging-authorized'));
    } catch (cause) {
      showError(cause.message || 'Staging sign-in is unavailable. Try again in a minute.');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Continue';
    }
  });

  dialog.showModal();
  input.focus();
})();
