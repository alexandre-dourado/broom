// ============================================================
// THE BROOM — Google Apps Script Backend
// Deploy: Web App, "Anyone" access
// ============================================================

const SHEETS = {
  ITEMS: 'items',
  CATEGORIES: 'categories',
  SETTINGS: 'settings'
};

const HEADERS = {
  items: ['id', 'title', 'description', 'category', 'archived', 'createdAt', 'updatedAt', 'manualOrder'],
  categories: ['id', 'name', 'color', 'icon'],
  settings: ['key', 'value']
};

const DEFAULT_CATEGORIES = [
  ['cat-1', 'Conselho de Saúde', '#00C2A8', 'health-council'],
  ['cat-2', 'IA',                '#6C63FF', 'robot'],
  ['cat-3', 'Rootz',             '#FF6B35', 'rootz'],
  ['cat-4', 'Filosofia',         '#E8D44D', 'phi'],
  ['cat-5', 'Faculdade',         '#4A90D9', 'mortarboard'],
  ['cat-6', 'Health',            '#FF4D6D', 'ecg'],
  ['cat-7', 'Money',             '#2ECC71', 'money']
];

// ============================================================
// HTTP ROUTING
// ============================================================

function doGet(e) {
  const action = e?.parameter?.action || 'ping';
  const handlers = {
    ping:          () => ({ success: true, message: 'The Broom API online' }),
    getItems:      getItems,
    getCategories: getCategories,
    getSettings:   getSettings
  };
  const fn = handlers[action];
  if (!fn) return respond({ error: 'Unknown GET action: ' + action });
  try { return respond(fn(e?.parameter)); }
  catch (err) { return respond({ error: err.message }); }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (_) { return respond({ error: 'Invalid JSON body' }); }

  const { action, payload } = body;
  const handlers = {
    addItem:        addItem,
    updateItem:     updateItem,
    archiveItem:    archiveItem,
    deleteItem:     deleteItem,
    addCategory:    addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
    saveSetting:    saveSetting,
    syncBatch:      syncBatch
  };

  const fn = handlers[action];
  if (!fn) return respond({ error: 'Unknown POST action: ' + action });
  try { return respond(fn(payload)); }
  catch (err) { return respond({ error: err.message }); }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SETUP
// ============================================================

function configSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(SHEETS).forEach(([key, name]) => {
    createOrRepairSheet(ss, name, HEADERS[key.toLowerCase()]);
  });
  seedDefaultData(ss);
  Logger.log('Sheets configuradas com sucesso.');
}

function createOrRepairSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join('|') !== headers.join('|')) {
    const data = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues() : [];
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (data.length) sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  }
}

function seedDefaultData(ss) {
  const catSheet = ss.getSheetByName(SHEETS.CATEGORIES);
  if (catSheet.getLastRow() <= 1) {
    catSheet.getRange(2, 1, DEFAULT_CATEGORIES.length, 4).setValues(DEFAULT_CATEGORIES);
  }
}

function debugSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = [];
  Object.entries(SHEETS).forEach(([key, name]) => {
    const expected = HEADERS[key.toLowerCase()];
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      createOrRepairSheet(ss, name, expected);
      report.push(`Recriada: ${name}`);
      return;
    }
    const current = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
    if (current.join('|') !== expected.join('|')) {
      createOrRepairSheet(ss, name, expected);
      report.push(`Cabeçalhos corrigidos: ${name}`);
    } else {
      report.push(`OK: ${name}`);
    }
  });
  Logger.log(report.join('\n'));
  return report;
}

// ============================================================
// ITEMS CRUD
// ============================================================

function getItems() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ITEMS);
  const last = sheet.getLastRow();
  if (last <= 1) return { items: [] };
  const data = sheet.getRange(2, 1, last - 1, HEADERS.items.length).getValues();
  const items = data.map(row => rowToObj(row, HEADERS.items)).filter(i => i.id);
  return { items };
}

function addItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ITEMS);
  const now = new Date().toISOString();
  const id = payload.id || Utilities.getUuid();
  const title = (payload.title || '').trim() || (payload.description || '').substring(0, 50) || 'Sem título';
  sheet.appendRow([
    id,
    title,
    payload.description || '',
    payload.category || 'cat-1',
    false,
    payload.createdAt || now,
    now,
    payload.manualOrder || ''
  ]);
  return { success: true, id };
}

function updateItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ITEMS);
  const row = findRowById(sheet, payload.id);
  if (!row) return { error: 'Item não encontrado: ' + payload.id };
  const now = new Date().toISOString();
  const title = (payload.title || '').trim() || (payload.description || '').substring(0, 50) || 'Sem título';
  const updates = [
    payload.id,
    title,
    payload.description || '',
    payload.category || '',
    payload.archived ?? false,
    payload.createdAt || now,
    now,
    payload.manualOrder || ''
  ];
  sheet.getRange(row, 1, 1, HEADERS.items.length).setValues([updates]);
  return { success: true };
}

function archiveItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ITEMS);
  const row = findRowById(sheet, payload.id);
  if (!row) return { error: 'Item não encontrado' };
  sheet.getRange(row, 5).setValue(true);
  sheet.getRange(row, 7).setValue(new Date().toISOString());
  return { success: true };
}

function deleteItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ITEMS);
  const row = findRowById(sheet, payload.id);
  if (!row) return { error: 'Item não encontrado' };
  sheet.deleteRow(row);
  return { success: true };
}

// ============================================================
// CATEGORIES CRUD
// ============================================================

function getCategories() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CATEGORIES);
  const last = sheet.getLastRow();
  if (last <= 1) return { categories: [] };
  const data = sheet.getRange(2, 1, last - 1, HEADERS.categories.length).getValues();
  return { categories: data.map(row => rowToObj(row, HEADERS.categories)).filter(c => c.id) };
}

function addCategory(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CATEGORIES);
  const id = payload.id || Utilities.getUuid();
  sheet.appendRow([id, payload.name, payload.color, payload.icon || 'circle']);
  return { success: true, id };
}

function updateCategory(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CATEGORIES);
  const row = findRowById(sheet, payload.id);
  if (!row) return { error: 'Categoria não encontrada' };
  sheet.getRange(row, 1, 1, 4).setValues([[payload.id, payload.name, payload.color, payload.icon]]);
  return { success: true };
}

function deleteCategory(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CATEGORIES);
  const row = findRowById(sheet, payload.id);
  if (!row) return { error: 'Categoria não encontrada' };
  sheet.deleteRow(row);
  return { success: true };
}

// ============================================================
// SETTINGS
// ============================================================

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  const last = sheet.getLastRow();
  if (last <= 1) return { settings: {} };
  const data = sheet.getRange(2, 1, last - 1, 2).getValues();
  const settings = {};
  data.forEach(([key, value]) => { if (key) settings[key] = value; });
  return { settings };
}

function saveSetting(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  const last = sheet.getLastRow();
  if (last > 1) {
    const data = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === payload.key) {
        sheet.getRange(i + 2, 2).setValue(payload.value);
        return { success: true };
      }
    }
  }
  sheet.appendRow([payload.key, payload.value]);
  return { success: true };
}

// ============================================================
// BATCH SYNC (mobile offline queue flush)
// ============================================================

function syncBatch(payload) {
  const { operations } = payload;
  const results = [];
  const handlers = { addItem, updateItem, archiveItem, deleteItem };
  operations.forEach(op => {
    const fn = handlers[op.action];
    if (fn) {
      try { results.push({ action: op.action, id: op.payload?.id, ...fn(op.payload) }); }
      catch (e) { results.push({ action: op.action, id: op.payload?.id, error: e.message }); }
    }
  });
  return { success: true, results };
}

// ============================================================
// HELPERS
// ============================================================

function findRowById(sheet, id) {
  const last = sheet.getLastRow();
  if (last <= 1) return null;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return null;
}

function rowToObj(row, headers) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}
