// ============================================================
// THE BROOM — api.js
// GAS API layer + offline sync queue management
// ============================================================

// PASTE YOUR WEB APP URL HERE AFTER DEPLOYING GAS
const API_URL = 'https://script.google.com/macros/s/AKfycbwf87jgqfhaA948J6TNVRz656OQLz3ofyGXwynotCuFu-5hcJmkdMUO8AFBDAjSrVcj/exec';

// ============================================================
// CORE FETCH
// ============================================================

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' }, // GAS requires text/plain to avoid CORS preflight
    body:    JSON.stringify({ action, payload })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================================
// ITEMS
// ============================================================

async function apiGetItems() {
  return apiGet('getItems');
}

async function apiAddItem(item) {
  return apiPost('addItem', item);
}

async function apiUpdateItem(item) {
  return apiPost('updateItem', item);
}

async function apiArchiveItem(id) {
  return apiPost('archiveItem', { id });
}

async function apiDeleteItem(id) {
  return apiPost('deleteItem', { id });
}

// ============================================================
// CATEGORIES
// ============================================================

async function apiGetCategories() {
  return apiGet('getCategories');
}

async function apiAddCategory(cat) {
  return apiPost('addCategory', cat);
}

async function apiUpdateCategory(cat) {
  return apiPost('updateCategory', cat);
}

async function apiDeleteCategory(id) {
  return apiPost('deleteCategory', { id });
}

// ============================================================
// SETTINGS
// ============================================================

async function apiGetSettings() {
  return apiGet('getSettings');
}

async function apiSaveSetting(key, value) {
  return apiPost('saveSetting', { key, value });
}

// ============================================================
// SYNC — offline queue flush
// ============================================================

let _syncing = false;

async function syncOfflineQueue() {
  if (_syncing) return;
  if (!navigator.onLine) return;

  const queue = await getQueuedOperations();
  if (!queue.length) return;

  _syncing = true;

  try {
    const operations = queue.map(op => ({
      action:  op.action,
      payload: op.payload
    }));

    const result = await apiPost('syncBatch', { operations });

    if (result.success) {
      await clearQueue();
      console.log('[Sync] Fila sincronizada.', result.results);
    }
  } catch (err) {
    console.warn('[Sync] Falha ao sincronizar fila:', err.message);
  } finally {
    _syncing = false;
  }
}

// ============================================================
// FULL SYNC — pull from server → overwrite local
// ============================================================

async function fullSync() {
  if (!navigator.onLine) return false;

  try {
    const [itemsRes, catsRes] = await Promise.all([
      apiGetItems(),
      apiGetCategories()
    ]);

    if (itemsRes.items)      await bulkSaveItems(itemsRes.items);
    if (catsRes.categories)  await bulkSaveCategories(catsRes.categories);

    await saveSettingLocal('lastSync', new Date().toISOString());

    console.log('[Sync] Full sync concluída.', {
      items:      itemsRes.items?.length,
      categories: catsRes.categories?.length
    });

    return true;
  } catch (err) {
    console.warn('[Sync] Full sync falhou:', err.message);
    return false;
  }
}

// ============================================================
// CONNECTIVITY LISTENERS
// ============================================================

window.addEventListener('online', () => {
  console.log('[Connectivity] Online. Iniciando sync...');
  syncOfflineQueue().then(() => fullSync());
});

window.addEventListener('offline', () => {
  console.log('[Connectivity] Offline. Modo local ativado.');
});
