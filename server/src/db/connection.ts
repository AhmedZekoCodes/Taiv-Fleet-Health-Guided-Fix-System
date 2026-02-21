/*
this sets up the sqlite connection used across all repositories.
we open one connection at startup and reuse it everywhere.
*/

import Database from 'better-sqlite3';
import path from 'path';

// the db file lives next to the server process, outside of src
const DB_PATH = path.resolve(__dirname, '../../data/fleet.db');

let db: Database.Database | null = null;

// returns the shared database connection, creating it on first call
export function getDatabase(): Database.Database {
  if (db === null) {
    db = new Database(DB_PATH);
    // write-ahead logging gives us better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// closes the database connection cleanly (used during shutdown and tests)
export function closeDatabase(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}
