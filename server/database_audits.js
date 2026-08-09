const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data_audits.json');
let logs = [];

try {
  if (fs.existsSync(DB_FILE)) {
    logs = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
} catch (e) {
  logs = [];
}

function save() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save audit logs:', e);
  }
}

function recordLog(widgetId, userId, username, action, details = {}) {
  const log = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    widgetId,
    userId: userId || 'anonymous',
    username: username || 'Anonymous User',
    action, // e.g., "update_config", "share_org"
    details,
    timestamp: new Date().toISOString()
  };
  logs.push(log);
  save();
  return log;
}

function getLogsForWidget(widgetId) {
  return logs.filter(l => l.widgetId === widgetId);
}

module.exports = {
  recordLog,
  getLogsForWidget
};
