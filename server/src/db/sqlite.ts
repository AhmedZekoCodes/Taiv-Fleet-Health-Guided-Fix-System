/*
this module opens and closes the sqlite database.
we use the built-in node:sqlite module so no native compilation is needed.
*/

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

// opens a database at the given path, creating the file and its parent directory if needed.
// pass ':memory:' for an in-memory database (used in tests).
export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // write-ahead logging gives better read performance under concurrent access
  db.exec('PRAGMA journal_mode = WAL');
  // enforce foreign key constraints at the db level
  db.exec('PRAGMA foreign_keys = ON');

  return db;
}

// closes the database cleanly — call this on graceful shutdown
export function closeDatabase(db: DatabaseSync): void {
  db.close();
}
