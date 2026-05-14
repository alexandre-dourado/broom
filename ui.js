// ============================================================
// THE BROOM — ui.js
// All DOM rendering, modal management, visual state
// ============================================================

const UI = {

  // ============================================================
  // RENDER ALL
  // ============================================================

  renderAll() {
    this.renderGrid();
    this.renderCategoryFilters();
    this.applyView();
    this.applyZoom();
    this.updateThemeButton();
    this.updateViewButtons();
    this.updateSyncIndicator();
  },

  // ============================================================
  // GRID
  // ============================================================

  renderGrid() {
    const container = document.getElementById('grid');
    const items = getFilteredItems();

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${getIcon('plus', 32)}</div>
          <p>${STATE.showArchived ? 'Nenhum item arquivado.' : 'Nada por aqui ainda.'}</p>
        </div>`;
      return;
    }

    container.innerHTML = '';

    items.forEach((item, index) => {
      const card = this.createCard(item);
      card.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
      container.appendChild(card);
    });

    if (STATE.view === 'masonry') this.applyMasonry();
  },

  createCard(item) {
    const cat = getCategoryById(item.category);
    const color = cat?.color || '#444';
    const icon  = cat?.icon  || 'circle';

    const card = document.createElement('div');
    card.className = 'card card-enter';
    card.dataset.id = item.id;
    card.style.setProperty('--card-color', color);

    const showDesc = STATE.zoom >= 3 && item.description;

    card.innerHTML = `
      <div class="card-icon">${getIcon(icon, 14)}</div>
      <div class="card-body">
        <div class="card-title">${escapeHTML(item.title)}</div>
        ${showDesc ? `<div class="card-desc">${escapeHTML(truncate(item.description, 80))}</div>` : ''}
      </div>
    `;

    card.addEventListener('click', () => this.openModal(item));

    // Drag-and-drop (pointer events — works on touch + mouse)
    this.initDrag(card, item);

    return card;
  },

  // ============================================================
  // MASONRY
  // ============================================================

  applyMasonry() {
    const container = document.getElementById('grid');
    const cards = [...container.querySelectorAll('.card')];
    if (!cards.length) return;

    // Reset
    cards.forEach(c => { c.style.gridRow = ''; c.style.gridColumn = ''; });

    requestAnimationFrame(() => {
      const cols = getZoomCols();
      const gap  = 12;
      const colHeights = Array(cols).fill(0);

      cards.forEach((card, i) => {
        const col = colHeights.indexOf(Math.min(...colHeights));
        const row = Math.ceil(colHeights[col] / (gap + 10)) + 1;
        card.style.gridColumn = col + 1;
        card.style.gridRow    = `span ${Math.ceil((card.offsetHeight + gap) / (gap + 10))}`;
        colHeights[col] += card.offsetHeight + gap;
      });
    });
  },

  // ============================================================
  // VIEW & ZOOM
  // ============================================================

  applyView() {
    const grid = document.getElementById('grid');
    grid.dataset.view = STATE.view;
    if (STATE.view === 'masonry') {
      requestAnimationFrame(() => this.applyMasonry());
    }
  },

  applyZoom() {
    const grid = document.getElementById('grid');
    grid.dataset.zoom = STATE.zoom;
    // CSS handles columns + font size via data-zoom attribute
  },

  updateViewButtons() {
    ['grid','list','masonry'].forEach(v => {
      const btn = document.getElementById(`btn-view-${v}`);
      if (btn) btn.classList.toggle('active', STATE.view === v);
    });
  },

  // ============================================================
  // THEME
  // ============================================================

  updateThemeButton() {
    const btn = document.getElementById('btn-theme');
    if (!btn) return;
    btn.innerHTML = getIcon(STATE.theme === 'dark' ? 'sun' : 'moon', 18);
    btn.title = STATE.theme === 'dark' ? 'Modo claro' : 'Modo escuro';
  },

  // ============================================================
  // SYNC INDICATOR
  // ============================================================

  updateSyncIndicator() {
    const dot = document.getElementById('sync-dot');
    const btn = document.getElementById('btn-sync');
    if (!dot) return;
    dot.className = 'sync-dot ' + (
      STATE.syncing ? 'syncing' :
      STATE.online  ? 'online'  : 'offline'
    );
    if (btn) btn.title = STATE.syncing ? 'Sincronizando...' : STATE.online ? 'Sincronizado' : 'Offline';
  },

  // ============================================================
  // CATEGORY FILTERS
  // ============================================================

  renderCategoryFilters() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    bar.innerHTML = `
      <button class="filter-chip ${!STATE.filterCategory ? 'active' : ''}" data-cat="">
        Tudo
      </button>
      ${STATE.categories.map(cat => `
        <button class="filter-chip ${STATE.filterCategory === cat.id ? 'active' : ''}"
          data-cat="${cat.id}"
          style="--chip-color: ${cat.color}">
          <span class="chip-icon">${getIcon(cat.icon, 12)}</span>
          ${escapeHTML(cat.name)}
        </button>
      `).join('')}
    `;

    bar.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.filterCategory = btn.dataset.cat || null;
        this.renderCategoryFilters();
        this.renderGrid();
      });
    });
  },

  // ============================================================
  // MODAL
  // ============================================================

  openModal(item) {
    STATE.editingItem = item;
    const overlay = document.getElementById('modal-overlay');
    const title   = document.getElementById('modal-title');
    const desc    = document.getElementById('modal-description');
    const catSel  = document.getElementById('modal-category');
    const archBtn = document.getElementById('modal-archive');
    const heading = document.getElementById('modal-heading');

    // Populate category select
    catSel.innerHTML = STATE.categories.map(c => `
      <option value="${c.id}" ${item?.category === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>
    `).join('');

    if (item) {
      heading.textContent  = 'Editar item';
      title.value          = item.title       || '';
      desc.value           = item.description || '';
      catSel.value         = item.category    || '';
      archBtn.innerHTML    = item.archived ? getIcon('unarchive', 16) + ' Restaurar' : getIcon('archive', 16) + ' Arquivar';
      document.getElementById('modal-delete').style.display = '';
    } else {
      heading.textContent  = 'Novo item';
      title.value          = '';
      desc.value           = '';
      catSel.value         = STATE.categories[0]?.id || '';
      archBtn.innerHTML    = getIcon('archive', 16) + ' Arquivar';
      document.getElementById('modal-delete').style.display = 'none';
    }

    overlay.classList.add('open');
    requestAnimationFrame(() => title.focus());
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    STATE.editingItem = null;
  },

  // ============================================================
  // INSTANT CAPTURE
  // ============================================================

  showInstantCapture() {
    const el = document.getElementById('instant-capture');
    el.classList.add('open');
    requestAnimationFrame(() => document.getElementById('instant-input').focus());
  },

  hideInstantCapture() {
    document.getElementById('instant-capture').classList.remove('open');
    document.getElementById('instant-input').value = '';
  },

  // ============================================================
  // SETTINGS PANEL
  // ============================================================

  openSettings() {
    const overlay = document.getElementById('settings-overlay');
    overlay.classList.add('open');

    // Populate current values
    document.getElementById('settings-theme').value        = STATE.theme;
    document.getElementById('settings-fab').value          = STATE.fabMode;
    document.getElementById('settings-default-view').value = STATE.view;

    UI.renderCategoryManager();
  },

  closeSettings() {
    document.getElementById('settings-overlay').classList.remove('open');
  },

  renderCategoryManager() {
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = STATE.categories.map(cat => `
      <div class="cat-row" data-id="${cat.id}">
        <span class="cat-swatch" style="background:${cat.color}">${getIcon(cat.icon, 14)}</span>
        <span class="cat-name">${escapeHTML(cat.name)}</span>
        <button class="cat-edit-btn icon-btn" data-id="${cat.id}" title="Editar">${getIcon('edit', 14)}</button>
        <button class="cat-del-btn icon-btn danger" data-id="${cat.id}" title="Excluir">${getIcon('trash', 14)}</button>
      </div>
    `).join('');

    list.querySelectorAll('.cat-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = STATE.categories.find(c => c.id === btn.dataset.id);
        if (cat) UI.showEditCategoryForm(cat);
      });
    });

    list.querySelectorAll('.cat-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir categoria? Os itens não serão excluídos.')) return;
        await deleteCategory(btn.dataset.id);
        UI.renderCategoryManager();
      });
    });
  },

  showAddCategoryForm() {
    UI._showCategoryForm(null);
  },

  showEditCategoryForm(cat) {
    UI._showCategoryForm(cat);
  },

  _showCategoryForm(cat) {
    const existing = document.getElementById('cat-form-inline');
    if (existing) existing.remove();

    const form = document.createElement('div');
    form.id = 'cat-form-inline';
    form.className = 'cat-form';
    form.innerHTML = `
      <input id="cat-form-name"  type="text"  placeholder="Nome" value="${cat ? escapeHTML(cat.name) : ''}" maxlength="30">
      <input id="cat-form-color" type="color" value="${cat?.color || '#888888'}">
      <select id="cat-form-icon">
        ${Object.keys(ICONS).filter(k => !['plus','search','grid','list','masonry','zoom-in','zoom-out','settings','archive','trash','edit','close','sun','moon','sync','filter','unarchive'].includes(k)).map(k => `
          <option value="${k}" ${cat?.icon === k ? 'selected' : ''}>${k}</option>
        `).join('')}
      </select>
      <div class="cat-form-actions">
        <button id="cat-form-save" class="btn-primary">${cat ? 'Salvar' : 'Adicionar'}</button>
        <button id="cat-form-cancel" class="btn-ghost">Cancelar</button>
      </div>
    `;

    document.getElementById('category-list').after(form);

    document.getElementById('cat-form-cancel').addEventListener('click', () => form.remove());
    document.getElementById('cat-form-save').addEventListener('click', async () => {
      const name  = document.getElementById('cat-form-name').value.trim();
      const color = document.getElementById('cat-form-color').value;
      const icon  = document.getElementById('cat-form-icon').value;
      if (!name) return;

      if (cat) {
        await updateCategory(cat.id, { name, color, icon });
      } else {
        await createCategory({ name, color, icon });
      }
      form.remove();
      UI.renderCategoryManager();
    });
  },

  // ============================================================
  // DRAG & DROP (pointer events — touch safe)
  // ============================================================

  initDrag(card, item) {
    let startX, startY, startEl, ghost, active = false;

    card.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      startX = e.clientX;
      startY = e.clientY;
      startEl = card;

      const longPress = setTimeout(() => {
        active = true;
        card.setPointerCapture(e.pointerId);
        card.classList.add('dragging');

        ghost = card.cloneNode(true);
        ghost.className = 'card drag-ghost';
        ghost.style.width  = card.offsetWidth + 'px';
        ghost.style.height = card.offsetHeight + 'px';
        ghost.style.setProperty('--card-color', card.style.getPropertyValue('--card-color'));
        document.body.appendChild(ghost);
      }, 350);

      card.addEventListener('pointermove', e => {
        if (!active) {
          if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) clearTimeout(longPress);
          return;
        }
        ghost.style.left = e.clientX - ghost.offsetWidth / 2 + 'px';
        ghost.style.top  = e.clientY - ghost.offsetHeight / 2 + 'px';

        // Find drop target
        ghost.style.display = 'none';
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card');
        ghost.style.display = '';

        document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
        if (el && el !== card) el.classList.add('drag-over');

      }, { passive: true });

      card.addEventListener('pointerup', async e => {
        clearTimeout(longPress);
        if (!active) return;
        active = false;
        card.classList.remove('dragging');
        ghost?.remove();

        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card[data-id]');
        document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));

        if (target && target.dataset.id !== item.id) {
          await swapManualOrder(item.id, target.dataset.id);
        }
      }, { once: true });
    });
  }
};

// ============================================================
// DRAG SWAP
// ============================================================

async function swapManualOrder(idA, idB) {
  const a = STATE.items.find(i => i.id === idA);
  const b = STATE.items.find(i => i.id === idB);
  if (!a || !b) return;
  const tempOrder = a.manualOrder;
  await updateItem(idA, { manualOrder: b.manualOrder });
  await updateItem(idB, { manualOrder: tempOrder });
  STATE.sortMode = 'manual';
  UI.renderGrid();
}

// ============================================================
// UTILS
// ============================================================

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.substring(0, max) + '…';
}

function getZoomCols() {
  const map = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  return map[STATE.zoom] || 4;
}
