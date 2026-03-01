'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let config = null;
let paused = false;
let timerId = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const dashboard    = document.getElementById('dashboard');
const lastUpdated  = document.getElementById('last-updated');
const btnPause     = document.getElementById('btn-pause');
const btnRefresh   = document.getElementById('btn-refresh');
const iconPause    = document.getElementById('icon-pause');
const iconPlay     = document.getElementById('icon-play');

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(value, scale) {
  const n = parseFloat(value) * scale;
  if (isNaN(n)) return '—';
  // Smart precision: show decimals only when useful
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 100)  return n.toFixed(1);
  return n.toFixed(2);
}

function tsNow() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Victoria Metrics query ─────────────────────────────────────────────────
async function queryMetric(baseUrl, query) {
  const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}&time=${Math.floor(Date.now() / 1000)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.error || 'VM error');
  const results = json.data?.result;
  if (!results || results.length === 0) return null;   // no data
  return results[0].value[1];                           // raw string value
}

// ── Render skeleton ────────────────────────────────────────────────────────
function renderSkeleton() {
  dashboard.innerHTML = '';
  for (const box of config.boxes) {
    const card = document.createElement('div');
    card.className = 'box';
    card.innerHTML = `<div class="box-title">${escHtml(box.title)}</div>`;

    for (const m of box.metrics) {
      const row = document.createElement('div');
      row.className = 'metric-row';
      row.dataset.query = m.query;
      row.dataset.scale = m.scale ?? 1;
      row.dataset.unit  = m.unit ?? '';
      row.innerHTML = `
        <span class="metric-label">${escHtml(m.label)}</span>
        <span class="metric-value-wrap">
          <span class="metric-value pending">…</span>
          <span class="metric-unit">${escHtml(m.unit ?? '')}</span>
        </span>`;
      card.appendChild(row);
    }
    dashboard.appendChild(card);
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Refresh all metrics ────────────────────────────────────────────────────
async function refresh() {
  if (!config) return;
  const baseUrl = config.victoriaMetrics.baseUrl;
  const rows = dashboard.querySelectorAll('.metric-row');

  await Promise.allSettled(
    Array.from(rows).map(async (row) => {
      const valueEl = row.querySelector('.metric-value');
      const scale   = parseFloat(row.dataset.scale) || 1;
      try {
        const raw = await queryMetric(baseUrl, row.dataset.query);
        valueEl.className = 'metric-value';
        valueEl.textContent = raw === null ? '—' : fmt(raw, scale);
      } catch {
        valueEl.className = 'metric-value error';
        valueEl.textContent = 'err';
      }
    })
  );

  lastUpdated.textContent = tsNow();
}

// ── Pause / resume ─────────────────────────────────────────────────────────
function setPaused(val) {
  paused = val;
  document.body.classList.toggle('paused', paused);
  iconPause.style.display = paused ? 'none' : '';
  iconPlay.style.display  = paused ? '' : 'none';
  btnPause.title        = paused ? 'Resume auto-refresh' : 'Pause auto-refresh';
  btnPause.ariaLabel    = btnPause.title;

  if (paused) {
    clearInterval(timerId);
    timerId = null;
  } else {
    startTimer();
  }
}

function startTimer() {
  const interval = config?.refresh?.interval ?? 1000;
  timerId = setInterval(refresh, interval);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('/config.json');
    if (!res.ok) throw new Error(`Cannot load config: HTTP ${res.status}`);
    config = await res.json();
  } catch (err) {
    dashboard.innerHTML = `<div class="error-msg">Failed to load config.json:<br>${escHtml(err.message)}</div>`;
    return;
  }

  renderSkeleton();
  await refresh();
  startTimer();
}

// ── Event listeners ────────────────────────────────────────────────────────
btnPause.addEventListener('click', () => setPaused(!paused));

btnRefresh.addEventListener('click', () => {
  // Spin the icon briefly
  btnRefresh.style.transition = 'transform .5s';
  btnRefresh.style.transform  = 'rotate(360deg)';
  setTimeout(() => {
    btnRefresh.style.transition = '';
    btnRefresh.style.transform  = '';
  }, 500);
  refresh();
});

// ── Start ──────────────────────────────────────────────────────────────────
init();
