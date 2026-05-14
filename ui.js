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
    const cat   = getCategoryById(item.category);
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

    cards.forEach(c => { c.style.gridRow = ''; c.style.gridColumn = ''; });

    requestAnimationFrame(() => {
      const cols = getZoomCols();
      const gap  = 12;
      const colHeights = Array(cols).fill(0);

      cards.forEach(card => {
        const col = colHeights.indexOf(Math.min(...colHeights));
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
    if (STATE.view === 'masonry') requestAnimationFrame(() => this.applyMasonry());
  },

  applyZoom() {
    document.getElementById('grid').dataset.zoom = STATE.zoom;
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
    if (!dot) return;
    dot.className = 'sync-dot ' + (
      STATE.syncing ? 'syncing' :
      STATE.online  ? 'online'  : 'offline'
    );
    const btn = document.getElementById('btn-sync');
    if (btn) btn.title = STATE.syncing ? 'Sincronizando...' : STATE.online ? 'Sincronizado' : 'Offline';
  },

  // ============================================================
  // CATEGORY FILTERS
  // ============================================================

  renderCategoryFilters() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    bar.innerHTML = `
      <button class="filter-chip ${!STATE.filterCategory ? 'active' : ''}" data-cat="">Tudo</button>
      ${STATE.categories.map(cat => `
        <button class="filter-chip ${STATE.filterCategory === cat.id ? 'active' : ''}"
          data-cat="${cat.id}" style="--chip-color:${cat.color}">
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
  // MODAL — ADD / EDIT
  // ============================================================

  openModal(item) {
    STATE.editingItem = item;
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const descEl  = document.getElementById('modal-description');
    const catSel  = document.getElementById('modal-category');
    const archBtn = document.getElementById('modal-archive');
    const heading = document.getElementById('modal-heading');

    catSel.innerHTML = STATE.categories.map(c => `
      <option value="${c.id}" ${item?.category === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>
    `).join('');

    if (item) {
      heading.textContent = 'Editar item';
      titleEl.value       = item.title       || '';
      descEl.value        = item.description || '';
      catSel.value        = item.category    || '';
      archBtn.innerHTML   = item.archived
        ? getIcon('unarchive', 16) + ' Restaurar'
        : getIcon('archive', 16)  + ' Arquivar';
      document.getElementById('modal-delete').style.display = '';
    } else {
      heading.textContent = 'Novo item';
      titleEl.value       = '';
      descEl.value        = '';
      catSel.value        = STATE.categories[0]?.id || '';
      archBtn.innerHTML   = getIcon('archive', 16) + ' Arquivar';
      document.getElementById('modal-delete').style.display = 'none';
    }

    overlay.classList.add('open');
    requestAnimationFrame(() => titleEl.focus());
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    STATE.editingItem = null;
  },

  // ============================================================
  // INSTANT CAPTURE
  // ============================================================

  showInstantCapture() {
    document.getElementById('instant-capture').classList.add('open');
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
    document.getElementById('settings-overlay').classList.add('open');
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
        if (cat) UI._showCategoryForm(cat);
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

  showAddCategoryForm()    { UI._showCategoryForm(null); },
  showEditCategoryForm(cat){ UI._showCategoryForm(cat);  },

  // ============================================================
  // CATEGORY FORM — com icon picker visual
  // ============================================================

  _showCategoryForm(cat) {
    const existing = document.getElementById('cat-form-inline');
    if (existing) existing.remove();

    let selectedIcon = cat?.icon || CATEGORY_ICON_KEYS[0];

    const form = document.createElement('div');
    form.id = 'cat-form-inline';
    form.className = 'cat-form';

    form.innerHTML = `
      <div class="cat-form-row">
        <input id="cat-form-name" type="text" placeholder="Nome da categoria"
          value="${cat ? escapeHTML(cat.name) : ''}" maxlength="30" autocomplete="off">
        <label class="color-pick-wrap" title="Cor">
          <input id="cat-form-color" type="color" value="${cat?.color || '#6C63FF'}">
          <span id="cat-color-preview" class="color-preview"
            style="background:${cat?.color || '#6C63FF'}"></span>
        </label>
      </div>

      <div class="icon-picker-header">
        <span class="icon-picker-label">Ícone</span>
        <span class="icon-picker-preview" id="icon-picker-preview">
          ${getIcon(selectedIcon, 16)}
          <span class="icon-picker-name">${selectedIcon}</span>
        </span>
      </div>

      <input id="icon-search" type="text" placeholder="Buscar ícone…"
        class="icon-search-input" autocomplete="off" spellcheck="false">

      <div class="icon-grid" id="icon-grid">
        ${CATEGORY_ICON_KEYS.map(k => `
          <button type="button" class="icon-cell${k === selectedIcon ? ' selected' : ''}"
            data-icon="${k}" title="${k}">
            ${getIcon(k, 20)}
          </button>
        `).join('')}
      </div>

      <div class="cat-form-actions">
        <button id="cat-form-cancel" class="btn-ghost">Cancelar</button>
        <button id="cat-form-save"   class="btn-primary">${cat ? 'Salvar' : 'Adicionar'}</button>
      </div>
    `;

    document.getElementById('category-list').after(form);

    // color preview live update
    const colorInput   = form.querySelector('#cat-form-color');
    const colorPreview = form.querySelector('#cat-color-preview');
    colorInput.addEventListener('input', e => {
      colorPreview.style.background = e.target.value;
    });

    // icon selection
    const iconGrid = form.querySelector('#icon-grid');

    function selectIcon(key) {
      selectedIcon = key;
      iconGrid.querySelectorAll('.icon-cell').forEach(c => {
        c.classList.toggle('selected', c.dataset.icon === key);
      });
      form.querySelector('#icon-picker-preview').innerHTML =
        getIcon(key, 16) + `<span class="icon-picker-name">${key}</span>`;
    }

    iconGrid.addEventListener('click', e => {
      const cell = e.target.closest('.icon-cell');
      if (cell) selectIcon(cell.dataset.icon);
    });

    // search filter
    form.querySelector('#icon-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      iconGrid.querySelectorAll('.icon-cell').forEach(cell => {
        cell.style.display = (!q || cell.dataset.icon.includes(q)) ? '' : 'none';
      });
    });

    // cancel
    form.querySelector('#cat-form-cancel').addEventListener('click', () => form.remove());

    // save
    form.querySelector('#cat-form-save').addEventListener('click', async () => {
      const name  = form.querySelector('#cat-form-name').value.trim();
      const color = form.querySelector('#cat-form-color').value;
      if (!name) { form.querySelector('#cat-form-name').focus(); return; }
      if (cat) {
        await updateCategory(cat.id, { name, color, icon: selectedIcon });
      } else {
        await createCategory({ name, color, icon: selectedIcon });
      }
      form.remove();
      UI.renderCategoryManager();
    });

    requestAnimationFrame(() => form.querySelector('#cat-form-name').focus());
  },

  // ============================================================
  // DRAG & DROP (pointer events — touch + mouse)
  // ============================================================

  initDrag(card, item) {
    let startX, startY, ghost, active = false, longPressTimer;

    card.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      startX = e.clientX;
      startY = e.clientY;

      longPressTimer = setTimeout(() => {
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

      const onMove = e => {
        if (!active) {
          if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
            clearTimeout(longPressTimer);
          }
          return;
        }
        ghost.style.left = e.clientX - ghost.offsetWidth  / 2 + 'px';
        ghost.style.top  = e.clientY - ghost.offsetHeight / 2 + 'px';

        ghost.style.display = 'none';
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card');
        ghost.style.display = '';

        document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
        if (el && el !== card) el.classList.add('drag-over');
      };

      const onUp = async e => {
        clearTimeout(longPressTimer);
        card.removeEventListener('pointermove', onMove);
        if (!active) return;
        active = false;
        card.classList.remove('dragging');
        ghost?.remove();

        ghost.style.display = 'none';
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card[data-id]');
        ghost.style.display = '';
        document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));

        if (target && target.dataset.id !== item.id) {
          await swapManualOrder(item.id, target.dataset.id);
        }
      };

      card.addEventListener('pointermove', onMove, { passive: true });
      card.addEventListener('pointerup',   onUp,   { once: true });
      card.addEventListener('pointercancel', () => {
        clearTimeout(longPressTimer);
        active = false;
        card.classList.remove('dragging');
        ghost?.remove();
        document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
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
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.substring(0, max) + '…';
}

function getZoomCols() {
  return ({ 1:2, 2:3, 3:4, 4:5, 5:6 })[STATE.zoom] || 4;
}
