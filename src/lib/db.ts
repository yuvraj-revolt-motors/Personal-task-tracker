
import { createClient } from '@libsql/client';
import path from 'path';

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(process.cwd(), 'tracker_v2.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log(`Initializing DB with URL: ${url}`);

const client = createClient({
  url,
  authToken,
});

let initPromise: Promise<void> | null = null;

async function initDb() {
  try {
    // Optimization: Batch most table creations and basic migrations
    // This reduces cross-region latency for each individual check.
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    title TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS memory_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    content TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS habits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    title TEXT NOT NULL,
                    subtitle TEXT,
                    icon TEXT,
                    color TEXT DEFAULT 'purple',
                    streak INTEGER DEFAULT 0,
                    track_streak INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS habit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    habit_id INTEGER,
                    date TEXT,
                    completed INTEGER DEFAULT 0,
                    time_spent INTEGER DEFAULT 0,
                    note TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(habit_id) REFERENCES habits(id)
                )`,
      `CREATE TABLE IF NOT EXISTS daily_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    date TEXT NOT NULL,
                    tle_minutes INTEGER DEFAULT 0,
                    note TEXT,
                    tomorrow_intent TEXT,
                    UNIQUE(user_id, date)
                )`,
      `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    name TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    date TEXT NOT NULL,
                    title TEXT NOT NULL,
                    completed INTEGER DEFAULT 0,
                    priority INTEGER DEFAULT 1,
                    note TEXT,
                    habit_id INTEGER,
                    section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
                    estimated_time INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS workout_schedule (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    day_index INTEGER,
                    day_name TEXT NOT NULL,
                    focus_area TEXT NOT NULL,
                    exercises TEXT,
                    UNIQUE(user_id, day_index)
                )`,
      `CREATE TABLE IF NOT EXISTS buying_list (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    item TEXT NOT NULL,
                    category TEXT,
                    completed INTEGER DEFAULT 0,
                    note TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS buying_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        )`,
      `CREATE TABLE IF NOT EXISTS finances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            amount REAL DEFAULT 0,
            type TEXT DEFAULT 'payment',
            total_months INTEGER DEFAULT 0,
            paid_months INTEGER DEFAULT 0,
            note TEXT,
            last_paid_month TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    await client.batch(schemaStatements, "write");

    // Sequential migrations (only if needed) - Wrap in try/catch individual for safety
    const migrations = [
      'ALTER TABLE habits ADD COLUMN subtitle TEXT',
      'ALTER TABLE habits ADD COLUMN icon TEXT',
      'ALTER TABLE habits ADD COLUMN color TEXT DEFAULT "purple"',
      'ALTER TABLE habits ADD COLUMN streak INTEGER DEFAULT 0',
      'ALTER TABLE habits ADD COLUMN track_streak INTEGER DEFAULT 0',
      'ALTER TABLE tasks ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL',
      'ALTER TABLE tasks ADD COLUMN estimated_time INTEGER',
      'ALTER TABLE tasks ADD COLUMN note TEXT',
      'ALTER TABLE daily_logs ADD COLUMN tomorrow_intent TEXT',
      'ALTER TABLE daily_logs ADD COLUMN dsa_done INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN dev_done INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN gym_done INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN work_done INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN secondary_work_mins INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN focus_done INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN dsa_time INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN dsa_note TEXT',
      'ALTER TABLE daily_logs ADD COLUMN dev_time INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN dev_note TEXT',
      'ALTER TABLE daily_logs ADD COLUMN gym_time INTEGER DEFAULT 0',
      'ALTER TABLE daily_logs ADD COLUMN gym_note TEXT',
      // Multi-user migrations
      'ALTER TABLE sections ADD COLUMN user_id INTEGER',
      'ALTER TABLE memory_rules ADD COLUMN user_id INTEGER',
      'ALTER TABLE habits ADD COLUMN user_id INTEGER',
      'ALTER TABLE habit_logs ADD COLUMN user_id INTEGER',
      'ALTER TABLE daily_logs ADD COLUMN user_id INTEGER',
      'ALTER TABLE tasks ADD COLUMN user_id INTEGER',
      'ALTER TABLE workout_schedule ADD COLUMN user_id INTEGER',
      'ALTER TABLE buying_list ADD COLUMN user_id INTEGER',
      'ALTER TABLE buying_categories ADD COLUMN user_id INTEGER',
      'ALTER TABLE habit_logs ADD COLUMN created_at TEXT',
      'UPDATE habit_logs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL',
      'ALTER TABLE buying_list ADD COLUMN note TEXT'
    ];

    for (const sql of migrations) {
      try { await client.execute(sql); } catch (e) { /* Expected if col exists */ }
    }

    // Migration: Assign existing null user_id to the first user if they exist
    const firstUser = await client.execute('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (firstUser.rows.length > 0) {
      const uid = firstUser.rows[0].id;
      const tablesToUpdate = ['sections', 'memory_rules', 'habits', 'habit_logs', 'daily_logs', 'tasks', 'workout_schedule', 'buying_list', 'buying_categories', 'finances'];
      for (const table of tablesToUpdate) {
        try {
          await client.execute({
            sql: `UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`,
            args: [uid]
          });
        } catch (err) { /* ignore */ }
      }
    }

  } catch (err) {
    console.error("Failed to initialize database:", err);
    // Reset promise to null so next call can try again? 
    // Or keep it rejected. Keeping it rejected is safer to avoid infinite loop of tries if persistent error.
    throw err;
  }
}

export async function getDb() {
  if (!initPromise) {
    initPromise = initDb();
  }
  try {
    await initPromise;
  } catch (e) {
    initPromise = null; // Retry next time? Or maybe fatal.
    throw e;
  }
  return client;
}
