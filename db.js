// ============================================================
// THE BROOM — db.js
// IndexedDB layer — offline-first persistence
// ============================================================

const DB_NAME    = 'thebroom-db';
const DB_VERSION = 1;

const STORES = {
  ITEMS:      'items',
  CATEGORIES: 'categories',
  SETTINGS:   'settings',
  SYNC_QUEUE: 'sync_queue'
};

let _db = null;

// ============================================================
// INIT
// ============================================================

function initDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        const itemStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
        itemStore.createIndex('createdAt',   'createdAt',   { unique: false });
        itemStore.createIndex('category',    'category',    { unique: false });
        itemStore.createIndex('archived',    'archived',    { unique: false });
        itemStore.createIndex('manualOrder', 'manualOrder', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const qStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'queueId', autoIncrement: true });
        qStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = e => {
      _db = e.target.result;
      resolve(_db);
    };

    request.onerror = e => reject(e.target.error);
  });
}

function getDB() {
  if (!_db) throw new Error('DB not initialized. Call initDB() first.');
  return _db;
}

// ============================================================
// GENERIC HELPERS
// ============================================================

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = e => reject(e.target.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

function dbPut(storeName, obj) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

function dbClear(storeName) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// ============================================================
// ITEMS
// ============================================================

async function getAllItemsLocal() {
  return dbGetAll(STORES.ITEMS);
}

async function getItemLocal(id) {
  return dbGet(STORES.ITEMS, id);
}

async function saveItemLocal(item) {
  item.updatedAt = item.updatedAt || new Date().toISOString();
  return dbPut(STORES.ITEMS, item);
}

async function deleteItemLocal(id) {
  return dbDelete(STORES.ITEMS, id);
}

async function bulkSaveItems(items) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ITEMS, 'readwrite');
    const store = tx.objectStore(STORES.ITEMS);
    items.forEach(item => store.put(item));
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

// ============================================================
// CATEGORIES
// ============================================================

async function getAllCategoriesLocal() {
  return dbGetAll(STORES.CATEGORIES);
}

async function saveCategoryLocal(cat) {
  return dbPut(STORES.CATEGORIES, cat);
}

async function deleteCategoryLocal(id) {
  return dbDelete(STORES.CATEGORIES, id);
}

async function bulkSaveCategories(categories) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CATEGORIES, 'readwrite');
    const store = tx.objectStore(STORES.CATEGORIES);
    categories.forEach(cat => store.put(cat));
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

// ============================================================
// SETTINGS
// ============================================================

async function getSettingLocal(key) {
  const record = await dbGet(STORES.SETTINGS, key);
  return record ? record.value : null;
}

async function saveSettingLocal(key, value) {
  return dbPut(STORES.SETTINGS, { key, value });
}

async function getAllSettingsLocal() {
  const all = await dbGetAll(STORES.SETTINGS);
  const obj = {};
  all.forEach(r => { obj[r.key] = r.value; });
  return obj;
}

// ============================================================
// SYNC QUEUE (offline operations buffer)
// ============================================================

async function enqueueOperation(action, payload) {
  const op = {
    action,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  return dbPut(STORES.SYNC_QUEUE, op);
}

async function getQueuedOperations() {
  return dbGetAll(STORES.SYNC_QUEUE);
}

async function clearQueue() {
  return dbClear(STORES.SYNC_QUEUE);
}

async function removeFromQueue(queueId) {
  return dbDelete(STORES.SYNC_QUEUE, queueId);
}
