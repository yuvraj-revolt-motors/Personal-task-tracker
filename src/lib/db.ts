
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
                    title TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS memory_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS habits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                    habit_id INTEGER,
                    date TEXT,
                    completed INTEGER DEFAULT 0,
                    time_spent INTEGER DEFAULT 0,
                    note TEXT,
                    FOREIGN KEY(habit_id) REFERENCES habits(id)
                )`,
      `CREATE TABLE IF NOT EXISTS daily_logs (
                    date TEXT PRIMARY KEY,
                    tle_minutes INTEGER DEFAULT 0,
                    note TEXT,
                    tomorrow_intent TEXT
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
                    day_index INTEGER PRIMARY KEY, -- 0=Sun, 1=Mon...
                    day_name TEXT NOT NULL,
                    focus_area TEXT NOT NULL,
                    exercises TEXT
                )`,
      `CREATE TABLE IF NOT EXISTS buying_list (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item TEXT NOT NULL,
                    category TEXT,
                    completed INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`,
      `CREATE TABLE IF NOT EXISTS buying_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
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
      'ALTER TABLE daily_logs ADD COLUMN gym_note TEXT'
    ];

    // Running migrations in a single attempt to reduce RTT
    for (const sql of migrations) {
      try { await client.execute(sql); } catch (e) { /* Expected if col exists */ }
    }

    // Seed defaults if empty (Check only once)
    const habitsCount = await client.execute('SELECT COUNT(*) as count FROM habits');
    if (habitsCount.rows[0].count === 0) {
      await client.execute(`INSERT INTO habits (title, subtitle, icon, color) VALUES
              ('DSA', 'Solve 1 Problem', '🧩', 'purple'),
              ('Learning', 'Dev / Playwright', '💻', 'amber'),
              ('Gym', 'Health & Fitness', '💪', 'red')`);
    }

    const secCount = await client.execute('SELECT count(*) as c FROM sections');
    const countVal = secCount.rows[0];

    if (Number(countVal?.c || 0) === 0 && Number(countVal?.[0] || 0) === 0) {
      const rs = await client.execute('SELECT * FROM sections LIMIT 1');
      if (rs.rows.length === 0) {
        await client.execute({ sql: 'INSERT INTO sections (title) VALUES (?)', args: ['Work'] });
        await client.execute({ sql: 'INSERT INTO sections (title) VALUES (?)', args: ['Personal'] });
        await client.execute({ sql: 'INSERT INTO sections (title) VALUES (?)', args: ['Revolt'] });
        await client.execute({ sql: 'INSERT INTO sections (title) VALUES (?)', args: ['TLE'] });
      }
    }

    const memInfo = await client.execute('SELECT * FROM memory_rules LIMIT 1');
    if (memInfo.rows.length === 0) {
      await client.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: ['DSA: Minimum 1 problem daily'] });
      await client.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: ['Health is non-negotiable'] });
      await client.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: ['Consistency > Intensity'] });
    }

    const catCheck = await client.execute('SELECT COUNT(*) as c FROM buying_categories');
    if (Number(catCheck.rows[0].c) === 0) {
      const defaults = ['General', 'Coco 🐶', 'Bike 🏍️', 'Household 🏠', 'Health ❤️'];
      for (const d of defaults) {
        await client.execute({ sql: 'INSERT OR IGNORE INTO buying_categories (name) VALUES (?)', args: [d] });
      }
    }

    // Seed Workout Schedule if empty
    const wsCount = await client.execute('SELECT count(*) as c FROM workout_schedule');
    if (Number(wsCount.rows[0]?.c || wsCount.rows[0]?.[0] || 0) === 0) {
      const wsRes = await client.execute('SELECT * FROM workout_schedule LIMIT 1');
      if (wsRes.rows.length === 0) {
        const manualSplit = [
          { i: 0, n: 'Sunday', f: 'Rest / Active Recovery', e: 'Light stretching, Walk' },
          { i: 1, n: 'Monday', f: 'Chest Day', e: 'Bench Press, Flies, Push ups' },
          { i: 2, n: 'Tuesday', f: 'Triceps', e: 'Pushdowns, Extensions, Dips' },
          { i: 3, n: 'Wednesday', f: 'Back', e: 'Pullups, Rows, Lat Pulldowns' },
          { i: 4, n: 'Thursday', f: 'Biceps', e: 'Curls, Hammer Curls' },
          { i: 5, n: 'Friday', f: 'Shoulders', e: 'Overhead Press, Lateral Raises' },
          { i: 6, n: 'Saturday', f: 'Leg Day', e: 'Squats, Lunges, Calf Raises' }
        ];
        for (const d of manualSplit) {
          await client.execute({
            sql: 'INSERT INTO workout_schedule (day_index, day_name, focus_area, exercises) VALUES (?, ?, ?, ?)',
            args: [d.i, d.n, d.f, d.e]
          });
        }
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
