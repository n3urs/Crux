/**
 * Database connection singleton
 * All database access goes through this module
 */

const path = require('path');
const fs = require('fs');

let db = null;

function getDataDir() {
  return process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');
}

function getDb() {
  if (db) return db;

  const Database = require('better-sqlite3');
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, 'boulderryn.db');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // If fresh database, apply schema
  const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='members'").get();
  if (tableCheck.count === 0) {
    const schemaPath = path.join(__dirname, '..', '..', 'shared', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Fresh database — schema applied.');
  }

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
