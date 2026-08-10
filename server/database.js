const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_FILE = path.join(__dirname, 'widgets.json');

// Helper to initialize the DB file with an empty list if it doesn't exist
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

// Read all widgets from JSON file
function getAll() {
  initDB();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return [];
  }
}

// Write widgets to JSON file
function saveAll(widgets) {
  initDB();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(widgets, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing to database file:', err);
    return false;
  }
}

// Get single widget by ID
function getById(id) {
  const widgets = getAll();
  return widgets.find((w) => w.id === id);
}

// Create a new widget configuration
function create(widgetData) {
  const widgets = getAll();
  const newWidget = {
    id: uuidv4(),
    userId: widgetData.userId || null,
    type: widgetData.type,
    name: widgetData.name || `My ${widgetData.type} Widget`,
    config: widgetData.config || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  widgets.push(newWidget);
  saveAll(widgets);
  return newWidget;
}

// Update an existing widget configuration
function update(id, widgetData) {
  const widgets = getAll();
  const index = widgets.findIndex((w) => w.id === id);
  if (index === -1) return null;

  const currentWidget = widgets[index];
  const nextWidget = {
    ...currentWidget,
    updatedAt: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(widgetData || {})) {
    if (value === undefined) continue;
    if (key === 'config') {
      nextWidget.config = { ...(currentWidget.config || {}), ...(value || {}) };
      continue;
    }
    if (key === 'id' || key === 'createdAt') continue;
    nextWidget[key] = value;
  }

  widgets[index] = {
    ...nextWidget,
  };

  saveAll(widgets);
  return widgets[index];
}

// Delete a widget by ID
function remove(id) {
  const widgets = getAll();
  const filtered = widgets.filter((w) => w.id !== id);
  if (widgets.length === filtered.length) return false;
  saveAll(filtered);
  return true;
}

// Async query abstractions for SQLite/Prisma ORM migration
async function getAllAsync() {
  return Promise.resolve(getAll());
}

async function getByIdAsync(id) {
  return Promise.resolve(getById(id));
}

async function createAsync(widgetData) {
  return Promise.resolve(create(widgetData));
}

async function updateAsync(id, widgetData) {
  return Promise.resolve(update(id, widgetData));
}

async function removeAsync(id) {
  return Promise.resolve(remove(id));
}

module.exports = {
  getAll,
  saveAll,
  getById,
  create,
  update,
  delete: remove,
  getAllAsync,
  getByIdAsync,
  createAsync,
  updateAsync,
  removeAsync,
};
