// SPDX-License-Identifier: AGPL-3.0-or-later
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnv } from "./env.js";

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "schema.sql"), "utf8");

/** Opens (and migrates) a database. Use ":memory:" in tests. */
export function openDb(path: string): Database.Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

let singleton: Database.Database | undefined;
export function getDb(): Database.Database {
  singleton ??= openDb(join(getEnv().dataDir, "wizard.db"));
  return singleton;
}
