
import { createClient } from '@libsql/client';
import path from 'path';

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(process.cwd(), 'tracker.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log(`Initializing DB with URL: ${url}`);

const client = createClient({
  url,
  authToken,
});

let initialized = false;

export async function getDb() {
  if (!initialized) {
    try {
      // 1. Create Tables
      // Use execute sequence instead of batch for consistent behavior across drivers if mixed
      await client.execute(`CREATE TABLE IF NOT EXISTS sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`);

      await client.execute(`CREATE TABLE IF NOT EXISTS memory_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`);

      await client.execute(`CREATE TABLE IF NOT EXISTS daily_logs (
                    date TEXT PRIMARY KEY,
                    tle_minutes INTEGER DEFAULT 0,
                    note TEXT,
                    tomorrow_intent TEXT
                )`);

      await client.execute(`CREATE TABLE IF NOT EXISTS habits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    priority INTEGER DEFAULT 1,
                    is_archived INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`);

      await client.execute(`CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    title TEXT NOT NULL,
                    completed INTEGER DEFAULT 0,
                    priority INTEGER DEFAULT 1,
                    note TEXT,
                    habit_id INTEGER,
                    section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`);

      // 2. Migrations
      // Try/Catch blocks for safe migrations
      try {
        await client.execute(`ALTER TABLE tasks ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL`);
      } catch (e) { /* ignore */ }

      try {
        await client.execute(`ALTER TABLE daily_logs ADD COLUMN tomorrow_intent TEXT`);
      } catch (e) { /* ignore */ }


      // 3. Seed Defaults
      const secCount = await client.execute('SELECT count(*) as c FROM sections');
      // libSQL rows are objects or arrays depending on config, but standard client returns rows as objects usually if not specified
      // actually standard client returns { columns, rows, types }. rows are array of array (if int mode) or objects? 
      // Default is objects { c: 2 } or array values [2].
      // To be safe, we check what it returns or just use a count check. 
      // Let's assume standard object access row['c'] or row.c if mapped. 
      // Better to use safe access.
      const countVal = secCount.rows[0];
      // @libsql/client returns rows as Objects { c: 0 } by default? 
      // Actually it returns 'Result' object. rows is Row[].

      if (Number(countVal?.c || 0) === 0 && Number(countVal?.[0] || 0) === 0) {
        // Check if it's 0 (handling both array/object response potential)
        // actually simpler:
        const rs = await client.execute('SELECT * FROM sections LIMIT 1');
        if (rs.rows.length === 0) {
          await client.execute({ sql: 'INSERT INTO sections (title) VALUES (?)', args: ['Work'] });
          await client.execute({ sql: 'INSERT INTO sections (title) VALUES (?)', args: ['Personal'] });
        }
      }

      const memInfo = await client.execute('SELECT * FROM memory_rules LIMIT 1');
      if (memInfo.rows.length === 0) {
        await client.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: ['DSA: Minimum 1 problem daily'] });
        await client.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: ['Health is non-negotiable'] });
        await client.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: ['Consistency > Intensity'] });
      }

      initialized = true;
    } catch (err) {
      console.error("Failed to initialize database:", err);
      throw err;
    }
  }
  return client;
}
