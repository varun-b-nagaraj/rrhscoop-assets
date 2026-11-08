/* api/v1/ecwid/stats.js
 *
 * Public, read-only store stats for the homepage "By the Numbers" tile.
 *
 * GET /api/v1/ecwid/stats ->
 *   { siteVisits: number|null, deliveries: number|null, updatedAt: ISO string }
 *
 * - siteVisits: all-time visitors from the Ecwid `allTraffic` report.
 *   Requires the `read_store_stats` scope on the token (RRHS_ECWID_STATS_TOKEN,
 *   falling back to RRHS_ECWID_API_TOKEN). Returns null when unavailable.
 * - deliveries: all-time count of orders whose fulfillment status is DELIVERED.
 *
 * Results are cached in memory so the homepage never hammers the Ecwid API.
 */

'use strict';

const CACHE_TTL_MS = 10 * 60 * 1000;
let cached = null;
let cachedAt = 0;
let inflight = null;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, obj) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600');
  res.end(JSON.stringify(obj));
}

function config() {
  const storeId = String(process.env.RRHS_ECWID_STORE_ID || '').trim();
  const apiBase = String(process.env.RRHS_ECWID_API_BASE || 'https://app.ecwid.com/api/v3')
    .trim()
    .replace(/\/+$/, '');
  const token = String(process.env.RRHS_ECWID_API_TOKEN || '').trim();
  const statsToken = String(process.env.RRHS_ECWID_STATS_TOKEN || '').trim() || token;
  return { storeId, apiBase, token, statsToken };
}

async function ecwidGet(cfg, path, token) {
  const resp = await fetch(`${cfg.apiBase}/${encodeURIComponent(cfg.storeId)}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`Ecwid ${path.split('?')[0]} responded ${resp.status}`);
  return resp.json();
}

function pickVisitorsMetric(report) {
  const rows = Array.isArray(report && report.aggregatedData) ? report.aggregatedData : [];
  const numeric = rows.filter((row) => row && Number.isFinite(Number(row.dataValue)));
  if (!numeric.length) return null;
  const preferred =
    numeric.find((row) => /unique.*visitor|visitor/i.test(String(row.dataId))) ||
    numeric.find((row) => /visit/i.test(String(row.dataId))) ||
    numeric[0];
  return Math.round(Number(preferred.dataValue));
}

async function fetchSiteVisits(cfg) {
  const report = await ecwidGet(cfg, '/reports/allTraffic', cfg.statsToken);
  return pickVisitorsMetric(report);
}

async function fetchDeliveries(cfg) {
  const data = await ecwidGet(
    cfg,
    '/orders?limit=1&fulfillmentStatus=DELIVERED&responseFields=total',
    cfg.token
  );
  const total = Number(data && data.total);
  return Number.isFinite(total) ? total : null;
}

async function loadStats() {
  const cfg = config();
  if (!cfg.storeId || !cfg.token) throw new Error('Ecwid store ID or token is not configured');

  const [visits, deliveries] = await Promise.allSettled([fetchSiteVisits(cfg), fetchDeliveries(cfg)]);
  if (visits.status === 'rejected') console.warn('[rrhs-stats] site visits:', visits.reason.message);
  if (deliveries.status === 'rejected') console.warn('[rrhs-stats] deliveries:', deliveries.reason.message);

  return {
    siteVisits: visits.status === 'fulfilled' ? visits.value : null,
    deliveries: deliveries.status === 'fulfilled' ? deliveries.value : null,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    if (!cached || Date.now() - cachedAt > CACHE_TTL_MS) {
      if (!inflight) {
        inflight = loadStats().finally(() => {
          inflight = null;
        });
      }
      const fresh = await inflight;
      // Keep the last good value for any metric that failed this round.
      cached = {
        siteVisits: fresh.siteVisits ?? (cached && cached.siteVisits) ?? null,
        deliveries: fresh.deliveries ?? (cached && cached.deliveries) ?? null,
        updatedAt: fresh.updatedAt,
      };
      cachedAt = Date.now();
    }
    return sendJson(res, 200, cached);
  } catch (err) {
    console.error('[rrhs-stats]', err && err.message);
    return sendJson(res, 200, { siteVisits: null, deliveries: null, error: 'unavailable' });
  }
};

module.exports._pickVisitorsMetric = pickVisitorsMetric;
