(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'rrhs-hunt-dashboard-session';
  const SPOTS = window.RRHS_HUNT_CONFIG.locations, TOTAL = SPOTS.length;
  const STICKERS = Object.fromEntries(SPOTS.map(spot => [spot.id, spot.label]));
  const STATUS = { active: 'Live', paused: 'Resetting', sold_out: 'Sold out', expired: 'Ended', scheduled: 'Not started', disabled: 'Off' };
  let session = null, data = null;
  try { session = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const when = value => { const date = new Date(value); return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date) : escape(value); };
  const sticker = id => escape(STICKERS[id] || id || '');

  async function call(action, payload) {
    const response = await fetch('/api/v1/easter-hunt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || 'Something went wrong. Try again.'), { status: response.status });
    return result;
  }
  function busy(button, on) { button.disabled = on; }

  function showSignIn(message) {
    session = null; try { sessionStorage.removeItem(KEY); } catch (_) {}
    $('board').hidden = true; $('sign-in').hidden = false;
    $('sign-in-status').textContent = message || '';
  }
  $('password-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; busy(button, true);
    $('sign-in-status').textContent = 'Signing in…';
    try {
      const result = await call('admin-login', { password: $('password').value });
      session = { token: result.token, expiresAt: result.expiresAt };
      try { sessionStorage.setItem(KEY, JSON.stringify(session)); } catch (_) {}
      $('password').value = ''; $('sign-in-status').textContent = ''; await load();
    } catch (error) { $('sign-in-status').textContent = error.message; }
    finally { busy(button, false); }
  });

  function emailPill(status) {
    return status === 'sent' ? '<span class="pill">Sent</span>' : status === 'failed' ? '<span class="pill bad">Failed · needs a look</span>' : `<span class="pill wait">${escape(status || 'Pending')}</span>`;
  }
  function render(result) {
    data = result;
    $('sign-in').hidden = true; $('board').hidden = false;
    $('signed-in').textContent = `Signed in as ${result.email}`;
    $('status').textContent = STATUS[result.status] || result.status;
    $('promo').textContent = result.status === 'disabled' ? 'Turn on with RRHS_HUNT_ENABLED in Vercel' : 'Promo ' + (result.promo || '');
    // The website config and the server's reward list must name the same stickers.
    const known = new Set((result.eggs || []).map(egg => egg.id)), missing = SPOTS.filter(spot => !known.has(spot.id)).length;
    $('outdated').hidden = !missing;
    $('outdated').textContent = missing ? `The server doesn’t know ${missing} of the ${TOTAL} stickers, so they can’t be claimed. Redeploy the latest code to Vercel.` : '';
    $('claimed').textContent = `${result.claims.length}/${(result.eggs || []).length || TOTAL}`;
    $('left').textContent = result.remaining;
    $('pool').textContent = result.pool.length ? 'Left: ' + [...result.pool].sort((a, b) => a - b).map(p => p + '%').join(', ') : 'All rewards claimed';
    $('claims').innerHTML = [...result.claims].reverse().map(c => `<tr><td>${when(c.at)}</td><td><strong>${escape(c.studentId)}</strong></td><td>${sticker(c.eggId)}</td>
      <td class="num">${c.percentage}%</td><td><code>${escape(c.code)}</code></td><td>${emailPill(c.emailStatus)}</td></tr>`).join('');
    $('claims-empty').hidden = result.claims.length > 0;
    const owners = Object.fromEntries(result.claims.map(c => [c.eggId, c.studentId]));
    const reward = Object.fromEntries((result.eggs || []).map(egg => [egg.id, egg]));
    $('stickers').innerHTML = [...SPOTS].sort((a, b) => (reward[b.id]?.percentage || 0) - (reward[a.id]?.percentage || 0)).map(spot => {
      const egg = reward[spot.id] || {}, owner = owners[spot.id];
      const state = owner ? `<span class="pill wait">${escape(owner)}</span>` : egg.available ? '<span class="pill">Hidden</span>' : '<span class="pill bad">Off</span>';
      return `<li><button type="button" class="spot" data-spot="${escape(spot.id)}" aria-label="Show where the ${escape(spot.label)} sticker is">
        <span class="spot-name"><strong>${egg.percentage ? egg.percentage + '%' : ''}</strong> ${escape(spot.label)}</span>${state}</button></li>`;
    }).join('');
    $('events').innerHTML = result.events.map(e => `<tr><td>${when(e.at)}</td><td>${escape(e.event)}</td><td>${escape(e.studentId)}</td><td>${sticker(e.eggId)}</td>
      <td>${[e.reward, e.code && `<code>${escape(e.code)}</code>`, escape(e.detail)].filter(Boolean).join(' · ')}</td></tr>`).join('');
    $('events-empty').hidden = result.events.length > 0;
    $('notice').textContent = `Updated ${when(new Date())}`;
  }
  async function load(action = 'admin-log') {
    if (!session) return showSignIn();
    try { render(await call(action, { token: session.token })); }
    catch (error) { if (error.status === 401) showSignIn(error.message); else $('notice').textContent = error.message; }
  }
  $('refresh').addEventListener('click', async () => { busy($('refresh'), true); await load(); busy($('refresh'), false); });
  // Click a sticker to see a screenshot of exactly where it hides.
  $('stickers').addEventListener('click', async event => {
    const button = event.target.closest('[data-spot]'); if (!button || !session) return;
    const spot = SPOTS.find(entry => entry.id === button.dataset.spot);
    $('spot-title').textContent = spot.label;
    $('spot-link').href = 'https://rrhscoop.roundrockisd.org' + spot.url; $('spot-link').textContent = 'rrhscoop.roundrockisd.org' + spot.url; $('spot-image').hidden = true; $('spot-status').textContent = 'Loading screenshot…';
    $('spot-dialog').showModal();
    try {
      const result = await call('admin-location', { token: session.token, id: spot.id });
      $('spot-image').src = result.image; $('spot-image').alt = 'Screenshot of the ' + spot.label + ' sticker, circled'; $('spot-image').hidden = false; $('spot-status').textContent = '';
    } catch (error) { if (error.status === 401) { $('spot-dialog').close(); showSignIn(error.message); } else $('spot-status').textContent = error.message; }
  });
  $('spot-close').addEventListener('click', () => $('spot-dialog').close());
  $('spot-dialog').addEventListener('click', event => { if (event.target === $('spot-dialog')) $('spot-dialog').close(); });
  $('sign-out').addEventListener('click', () => showSignIn('Signed out.'));
  setInterval(() => { if (session && !document.hidden) load(); }, 30000);
  if (session && session.expiresAt > Date.now()) load(); else showSignIn();
})();
