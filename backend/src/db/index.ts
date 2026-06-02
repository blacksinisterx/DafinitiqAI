import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './supportiq.db';
const resolvedPath = path.resolve(dbPath);

export const db = new Database(resolvedPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}
