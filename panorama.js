// ============================================================
// THE BROOM — panorama.js
// Gera uma nova aba com visão panorâmica de todos os itens
// agrupados por categoria — estático, sem interação, só leitura.
// Zoom interativo (2–6 colunas) controlado por botões flutuantes.
// ============================================================

function openPanorama() {
  const items      = STATE.items.filter(i => !i.archived);
  const categories = STATE.categories;

  // Agrupar itens por categoria, manter ordem cronológica
  const grouped = {};
  categories.forEach(cat => { grouped[cat.id] = []; });

  // Itens sem categoria conhecida vão para "Sem categoria"
  const UNCATEGORIZED = '__uncategorized__';
  grouped[UNCATEGORIZED] = [];

  items
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach(item => {
      if (grouped[item.category] !== undefined) {
        grouped[item.category].push(item);
      } else {
        grouped[UNCATEGORIZED].push(item);
      }
    });

  // Montar lista de grupos com itens (descartar vazios)
  const groups = [
    ...categories
      .map(cat => ({ cat, items: grouped[cat.id] }))
      .filter(g => g.items.length > 0),
    ...(grouped[UNCATEGORIZED].length > 0
      ? [{ cat: { id: UNCATEGORIZED, name: 'Sem categoria', color: '#555', icon: 'circle' }, items: grouped[UNCATEGORIZED] }]
      : [])
  ];

  if (!groups.length) {
    alert('Nenhum item para exibir no Panorama.');
    return;
  }

  const isDark  = STATE.theme === 'dark';
  const html    = buildPanoramaHTML(groups, isDark);
  const blob    = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const tab     = window.open(url, '_blank');

  // Revogar URL após carregar (pequena limpeza de memória)
  if (tab) {
    tab.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  }
}

// ============================================================
// HTML BUILDER
// ============================================================

function buildPanoramaHTML(groups, isDark) {
  const now     = new Date().toLocaleString('pt-BR');
  const total   = groups.reduce((acc, g) => acc + g.items.length, 0);

  const groupsHTML = groups.map(({ cat, items }) => `
    <div class="group" style="--cat-color:${cat.color}">
      <div class="group-header">
        <span class="group-dot"></span>
        <span class="group-name">${esc(cat.name)}</span>
        <span class="group-count">${items.length}</span>
      </div>
      <ol class="group-list">
        ${items.map(item => `
          <li class="group-item">
            <span class="item-title">${esc(item.title)}</span>
            ${item.description
              ? `<span class="item-desc">${esc(truncatePanorama(item.description, 120))}</span>`
              : ''}
          </li>
        `).join('')}
      </ol>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Broom — Panorama</title>
<style>
  /* ── Reset ───────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Tokens ──────────────────────────────────────────── */
  :root {
    --bg:       ${isDark ? '#0a0a0a' : '#f5f5f5'};
    --bg2:      ${isDark ? '#111'    : '#e8e8e8'};
    --bg3:      ${isDark ? '#1a1a1a' : '#dcdcdc'};
    --border:   ${isDark ? '#2a2a2a' : '#cccccc'};
    --text:     ${isDark ? '#f0f0f0' : '#111111'};
    --text2:    ${isDark ? '#888'    : '#555555'};
    --text3:    ${isDark ? '#444'    : '#aaaaaa'};
    --cols: 3;
    --gap:  12px;
    --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
    --font-body: 'Barlow', 'Helvetica Neue', sans-serif;
  }

  /* ── Base ────────────────────────────────────────────── */
  html { font-size: 14px; -webkit-font-smoothing: antialiased; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    padding: 52px 16px 40px;
    min-height: 100vh;
  }

  /* ── Toolbar ─────────────────────────────────────────── */
  .toolbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    height: 40px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    user-select: none;
  }

  .toolbar-brand {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    flex: 1;
  }

  .toolbar-brand span { opacity: 0.4; font-weight: 400; }

  .toolbar-meta {
    font-size: 0.72rem;
    color: var(--text2);
    font-family: var(--font-mono);
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text);
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: background 80ms;
  }

  .zoom-btn:hover { background: var(--border); }

  .zoom-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text2);
    min-width: 18px;
    text-align: center;
  }

  /* ── Grid ────────────────────────────────────────────── */
  .panorama {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: var(--gap);
    align-items: start;
  }

  /* ── Group ───────────────────────────────────────────── */
  .group {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-top: 3px solid var(--cat-color);
    border-radius: 2px;
    overflow: hidden;
    break-inside: avoid;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px 7px;
    border-bottom: 1px solid var(--border);
  }

  .group-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cat-color);
    flex-shrink: 0;
  }

  .group-name {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-count {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--text2);
    background: var(--bg3);
    padding: 1px 5px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* ── List ────────────────────────────────────────────── */
  .group-list {
    list-style: none;
    padding: 4px 0;
  }

  .group-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 5px 10px 5px 10px;
    border-bottom: 1px solid var(--border);
    counter-increment: item-counter;
    position: relative;
  }

  .group-item:last-child { border-bottom: none; }

  .group-item::before {
    content: counter(item-counter);
    position: absolute;
    left: 10px;
    top: 6px;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--text3);
    line-height: 1;
  }

  .group-list { counter-reset: item-counter; }

  .item-title {
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.4;
    padding-left: 18px;
    word-break: break-word;
  }

  .item-desc {
    font-size: 0.72rem;
    color: var(--text2);
    line-height: 1.5;
    padding-left: 18px;
    word-break: break-word;
  }

  /* ── Print ───────────────────────────────────────────── */
  @media print {
    .toolbar { display: none; }
    body { padding: 0; }
    .group { break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="toolbar">
  <div class="toolbar-brand">The Broom <span>/ Panorama</span></div>
  <div class="toolbar-meta">${total} itens · ${groups.length} categorias · ${esc(now)}</div>
  <div class="zoom-controls">
    <button class="zoom-btn" id="btn-less" title="Menos colunas">−</button>
    <span class="zoom-label" id="cols-label">3</span>
    <button class="zoom-btn" id="btn-more" title="Mais colunas">+</button>
  </div>
</div>

<div class="panorama" id="panorama">
  ${groupsHTML}
</div>

<script>
  const panorama  = document.getElementById('panorama');
  const colsLabel = document.getElementById('cols-label');
  let cols = 3;

  function setCols(n) {
    cols = Math.min(6, Math.max(1, n));
    panorama.style.setProperty('--cols', cols);
    colsLabel.textContent = cols;
  }

  document.getElementById('btn-less').addEventListener('click', () => setCols(cols - 1));
  document.getElementById('btn-more').addEventListener('click', () => setCols(cols + 1));

  // Responsive default
  function autoDefault() {
    const w = window.innerWidth;
    if (w < 500)       setCols(1);
    else if (w < 800)  setCols(2);
    else if (w < 1200) setCols(3);
    else if (w < 1600) setCols(4);
    else               setCols(5);
  }

  autoDefault();
  window.addEventListener('resize', autoDefault);
<\/script>

</body>
</html>`;
}

// ── Utils internos do Panorama ───────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncatePanorama(str, max) {
  if (!str || str.length <= max) return str;
  return str.substring(0, max) + '…';
}
