// ============================================================
// THE BROOM — app.js
// Core state, orchestration, event binding
// ============================================================

// ============================================================
// STATE
// ============================================================

const STATE = {
  items:          [],
  categories:     [],
  settings:       {},
  view:           'grid',      // 'grid' | 'list' | 'masonry'
  zoom:           3,           // 1–5 (cols: 2,3,4,5,6 / size)
  theme:          'dark',
  filterCategory: null,
  sortMode:       'newest',    // 'newest' | 'oldest' | 'manual'
  searchQuery:    '',
  showArchived:   false,
  editingItem:    null,        // item being edited in modal
  fabMode:        'modal',     // 'modal' | 'instant'
  syncing:        false,
  online:         navigator.onLine
};

// ============================================================
// INIT
// ============================================================

async function init() {
  await initDB();

  // Load settings first (theme, zoom, view, fabMode)
  await loadSettings();

  applyTheme(STATE.theme);

  // Load categories
  await loadCategories();

  // Load items
  await loadItems();

  // Render
  UI.renderAll();

  // Bind events
  bindEvents();

  // Register SW
  registerSW();

  // Attempt sync if online
  if (STATE.online) {
    await attemptFullSync();
  }
}

// ============================================================
// LOAD DATA
// ============================================================

async function loadSettings() {
  const s = await getAllSettingsLocal();
  STATE.theme   = s.theme   || 'dark';
  STATE.zoom    = parseInt(s.zoom) || 3;
  STATE.view    = s.view    || 'grid';
  STATE.fabMode = s.fabMode || 'modal';
}

async function loadCategories() {
  let cats = await getAllCategoriesLocal();
  if (!cats.length && STATE.online) {
    const res = await apiGetCategories().catch(() => null);
    if (res?.categories?.length) {
      await bulkSaveCategories(res.categories);
      cats = res.categories;
    }
  }
  STATE.categories = cats;
}

async function loadItems() {
  STATE.items = await getAllItemsLocal();
}

// ============================================================
// SYNC
// ============================================================

async function attemptFullSync() {
  if (!STATE.online) return;
  STATE.syncing = true;
  UI.updateSyncIndicator();
  await syncOfflineQueue();
  await fullSync();
  await loadItems();
  await loadCategories();
  STATE.syncing = false;
  UI.updateSyncIndicator();
  UI.renderGrid();
}

// ============================================================
// ITEMS — CRUD
// ============================================================

async function createItem(data) {
  const now = new Date().toISOString();
  const id   = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const title = (data.title || '').trim() || (data.description || '').substring(0, 50) || 'Sem título';

  const item = {
    id,
    title,
    description: data.description || '',
    category:    data.category || (STATE.categories[0]?.id || 'cat-1'),
    archived:    false,
    createdAt:   now,
    updatedAt:   now,
    manualOrder: STATE.items.length
  };

  await saveItemLocal(item);
  STATE.items.unshift(item);
  UI.renderGrid();

  if (STATE.online) {
    apiAddItem(item).catch(() => enqueueOperation('addItem', item));
  } else {
    enqueueOperation('addItem', item);
  }
}

async function updateItem(id, data) {
  const existing = await getItemLocal(id);
  if (!existing) return;

  const updated = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString()
  };

  if (!updated.title.trim() && updated.description) {
    updated.title = updated.description.substring(0, 50);
  }

  await saveItemLocal(updated);
  const idx = STATE.items.findIndex(i => i.id === id);
  if (idx !== -1) STATE.items[idx] = updated;
  UI.renderGrid();

  if (STATE.online) {
    apiUpdateItem(updated).catch(() => enqueueOperation('updateItem', updated));
  } else {
    enqueueOperation('updateItem', updated);
  }
}

async function archiveItem(id) {
  await updateItem(id, { archived: true });
  if (STATE.online) {
    apiArchiveItem(id).catch(() => enqueueOperation('archiveItem', { id }));
  } else {
    enqueueOperation('archiveItem', { id });
  }
}

async function unarchiveItem(id) {
  await updateItem(id, { archived: false });
  if (STATE.online) {
    const item = await getItemLocal(id);
    apiUpdateItem(item).catch(() => enqueueOperation('updateItem', item));
  }
}

async function deleteItem(id) {
  await deleteItemLocal(id);
  STATE.items = STATE.items.filter(i => i.id !== id);
  UI.renderGrid();

  if (STATE.online) {
    apiDeleteItem(id).catch(() => enqueueOperation('deleteItem', { id }));
  } else {
    enqueueOperation('deleteItem', { id });
  }
}

// ============================================================
// CATEGORIES — CRUD
// ============================================================

async function createCategory(data) {
  const id  = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
  const cat = { id, name: data.name, color: data.color, icon: data.icon || 'circle' };
  await saveCategoryLocal(cat);
  STATE.categories.push(cat);
  UI.renderCategoryFilters();
  if (STATE.online) {
    apiAddCategory(cat).catch(() => {});
  }
  return cat;
}

async function updateCategory(id, data) {
  const cat = { id, ...data };
  await saveCategoryLocal(cat);
  const idx = STATE.categories.findIndex(c => c.id === id);
  if (idx !== -1) STATE.categories[idx] = cat;
  UI.renderAll();
  if (STATE.online) {
    apiUpdateCategory(cat).catch(() => {});
  }
}

async function deleteCategory(id) {
  await deleteCategoryLocal(id);
  STATE.categories = STATE.categories.filter(c => c.id !== id);
  UI.renderAll();
  if (STATE.online) {
    apiDeleteCategory(id).catch(() => {});
  }
}

// ============================================================
// SETTINGS
// ============================================================

async function saveSetting(key, value) {
  STATE[key] = value;
  await saveSettingLocal(key, value);
  if (STATE.online) {
    apiSaveSetting(key, value).catch(() => {});
  }
}

// ============================================================
// THEME
// ============================================================

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

async function toggleTheme() {
  const next = STATE.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await saveSetting('theme', next);
  UI.updateThemeButton();
}

// ============================================================
// VIEW & ZOOM
// ============================================================

async function setView(view) {
  STATE.view = view;
  await saveSetting('view', view);
  UI.applyView();
  UI.updateViewButtons();
}

async function setZoom(delta) {
  STATE.zoom = Math.min(5, Math.max(1, STATE.zoom + delta));
  await saveSetting('zoom', STATE.zoom);
  UI.applyZoom();
}

// ============================================================
// FILTER & SEARCH
// ============================================================

function getFilteredItems() {
  let items = [...STATE.items];

  // Archived filter
  items = items.filter(i => STATE.showArchived ? i.archived : !i.archived);

  // Category filter
  if (STATE.filterCategory) {
    items = items.filter(i => i.category === STATE.filterCategory);
  }

  // Search
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }

  // Sort
  if (STATE.sortMode === 'newest') {
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (STATE.sortMode === 'oldest') {
    items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (STATE.sortMode === 'manual') {
    items.sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0));
  }

  return items;
}

function getCategoryById(id) {
  return STATE.categories.find(c => c.id === id) || null;
}

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {
  // FAB
  document.getElementById('fab').addEventListener('click', () => {
    if (STATE.fabMode === 'instant') {
      UI.showInstantCapture();
    } else {
      UI.openModal(null);
    }
  });

  // Search
  const searchEl = document.getElementById('search');
  searchEl.addEventListener('input', debounce(e => {
    STATE.searchQuery = e.target.value.trim();
    UI.renderGrid();
  }, 250));

  // View buttons
  document.getElementById('btn-view-grid').addEventListener('click', () => setView('grid'));
  document.getElementById('btn-view-list').addEventListener('click', () => setView('list'));
  document.getElementById('btn-view-masonry').addEventListener('click', () => setView('masonry'));

  // Panorama
  document.getElementById('btn-view-panorama').addEventListener('click', openPanorama);

  // Zoom
  document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(1));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(-1));

  // Theme toggle
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  // Settings
  document.getElementById('btn-settings').addEventListener('click', UI.openSettings);

  // Archived toggle
  document.getElementById('btn-archived').addEventListener('click', () => {
    STATE.showArchived = !STATE.showArchived;
    document.getElementById('btn-archived').classList.toggle('active', STATE.showArchived);
    UI.renderGrid();
  });

  // Sync button
  document.getElementById('btn-sync').addEventListener('click', async () => {
    if (!STATE.online) return;
    await attemptFullSync();
  });

  // Modal save
  document.getElementById('modal-save').addEventListener('click', handleModalSave);

  // Modal close
  document.getElementById('modal-close').addEventListener('click', UI.closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) UI.closeModal();
  });

  // Modal archive
  document.getElementById('modal-archive').addEventListener('click', async () => {
    if (!STATE.editingItem) return;
    const action = STATE.editingItem.archived ? unarchiveItem : archiveItem;
    await action(STATE.editingItem.id);
    UI.closeModal();
  });

  // Modal delete
  document.getElementById('modal-delete').addEventListener('click', async () => {
    if (!STATE.editingItem) return;
    if (!confirm('Excluir este item permanentemente?')) return;
    await deleteItem(STATE.editingItem.id);
    UI.closeModal();
  });

  // Instant capture
  document.getElementById('instant-save').addEventListener('click', handleInstantSave);
  document.getElementById('instant-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInstantSave();
    }
    if (e.key === 'Escape') UI.hideInstantCapture();
  });

  // Settings panel
  document.getElementById('settings-close').addEventListener('click', UI.closeSettings);
  document.getElementById('settings-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-overlay')) UI.closeSettings();
  });
  document.getElementById('settings-theme').addEventListener('change', async e => {
    applyTheme(e.target.value);
    await saveSetting('theme', e.target.value);
    UI.updateThemeButton();
  });
  document.getElementById('settings-fab').addEventListener('change', async e => {
    await saveSetting('fabMode', e.target.value);
  });
  document.getElementById('settings-default-view').addEventListener('change', async e => {
    await setView(e.target.value);
  });
  document.getElementById('btn-add-category').addEventListener('click', UI.showAddCategoryForm);

  // Connectivity
  window.addEventListener('online',  () => { STATE.online = true;  UI.updateSyncIndicator(); attemptFullSync(); });
  window.addEventListener('offline', () => { STATE.online = false; UI.updateSyncIndicator(); });
}

async function handleModalSave() {
  const title       = document.getElementById('modal-title').value.trim();
  const description = document.getElementById('modal-description').value.trim();
  const category    = document.getElementById('modal-category').value;

  if (!title && !description) {
    document.getElementById('modal-title').focus();
    return;
  }

  if (STATE.editingItem) {
    await updateItem(STATE.editingItem.id, { title, description, category });
  } else {
    await createItem({ title, description, category });
  }
  UI.closeModal();
}

async function handleInstantSave() {
  const val = document.getElementById('instant-input').value.trim();
  if (!val) return;
  await createItem({ title: val, category: STATE.categories[0]?.id || 'cat-1' });
  document.getElementById('instant-input').value = '';
  UI.hideInstantCapture();
}

// ============================================================
// SERVICE WORKER
// ============================================================

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  }
}

// ============================================================
// UTILS
// ============================================================

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ============================================================
// BOOT
// ============================================================

window.addEventListener('load', init);
