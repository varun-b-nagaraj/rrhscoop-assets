(function () {
  'use strict';
  let stats;
  const $ = id => document.getElementById(id);
  const escape = text => { const span = document.createElement('span'); span.textContent = text; return span.innerHTML; };
  async function update(input) {
    try {
      const response = await fetch('/api/v1/easter-hunt/admin', { method: input ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: input ? JSON.stringify(input) : undefined });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      stats = data;
      const metrics = { Status: data.status, Remaining: data.remaining, Claims: data.claims, 'Coupons issued': data.couponsIssued, 'Coupons redeemed': data.couponsRedeemed, 'Emails actually sent': data.emailsSent, 'Simulated failed emails': data.failedEmails, 'Maximum simulated liability': '$' + (data.maximumSimulatedLiabilityCents / 100).toFixed(2) };
      $('stats').innerHTML = '<div class="metric-grid">' + Object.entries(metrics).map(([label, value]) => `<div class="metric"><strong>${escape(String(value))}</strong>${label}</div>`).join('') + '</div><p>Remaining prize pool: ' + Object.entries(data.remainingDistribution).map(([p, count]) => `${p}% × ${count}`).join(' · ') + '</p>';
      $('eggs').innerHTML = data.eggs.map(egg => `<div class="row"><span>${escape(egg.id)} · ${egg.available ? 'available' : 'unavailable'}</span><span><button data-action="disable" data-egg="${egg.id}">Disable</button> <button data-action="enable" data-egg="${egg.id}">Enable</button></span></div>`).join('');
      $('claims').innerHTML = data.audit.filter(entry => entry.action === 'preview.claimed').map(entry => `<div class="row"><code>${escape(entry.claimId)}</code><span><button data-action="fail-email" data-claim="${entry.claimId}">Simulate email failure</button> <button data-action="retry-email" data-claim="${entry.claimId}">Retry simulated email</button></span></div>`).join('') || '<p>No preview claims yet.</p>';
      $('audit').textContent = JSON.stringify(data.audit, null, 2);
      if (input) $('notice').textContent = 'Preview updated. Storefront availability refreshes within 15 seconds.';
    } catch (error) { $('notice').textContent = error.message || 'Could not load the local preview.'; }
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    button.disabled = true;
    await update({ action: button.dataset.action, eggId: button.dataset.egg, claimId: button.dataset.claim });
    button.disabled = false;
  });
  $('export').addEventListener('click', () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify({ mode: 'preview', status: stats.status, claims: stats.claims, remainingDistribution: stats.remainingDistribution, couponsIssued: 0, emailsSent: 0 }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'hunt-preview-report.json'; link.click(); URL.revokeObjectURL(url);
  });
  update(); setInterval(() => { if (!document.hidden) update(); }, 15000);
})();
