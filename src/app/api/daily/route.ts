import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    try {
        const db = await getDb();

        // 1. Get Daily Summary
        const summaryRes = await db.execute({ sql: 'SELECT * FROM daily_logs WHERE date = ?', args: [date] });
        let summary: any = summaryRes.rows[0];
        if (!summary) summary = { date, tle_minutes: 0, note: '', tomorrow_intent: '' };

        // 2. Habits Logic
        const habitsRes = await db.execute('SELECT * FROM habits WHERE is_archived = 0');
        const habits = habitsRes.rows;

        const existingTasksRes = await db.execute({ sql: 'SELECT habit_id FROM tasks WHERE date = ? AND habit_id IS NOT NULL', args: [date] });
        const existingIds = new Set(existingTasksRes.rows.map((t: any) => t.habit_id));

        // Insert missing habits
        // We can do this in parallel or batch
        const newHabits = habits.filter((h: any) => !existingIds.has(h.id));
        if (newHabits.length > 0) {
            const batch = newHabits.map((h: any) => ({
                sql: 'INSERT INTO tasks (date, title, priority, habit_id, completed) VALUES (?, ?, ?, ?, 0)',
                args: [date, h.title, h.priority, h.id]
            }));
            if (batch.length > 0) await db.batch(batch, 'write');
        }

        // 3. FETCH TASKS
        const tasksRes = await db.execute({
            sql: `
            SELECT t.*, s.title as section_title 
            FROM tasks t
            LEFT JOIN sections s ON t.section_id = s.id
            WHERE 
            (t.date = ?) 
            OR 
            (t.date < ? AND t.completed = 0)
            ORDER BY t.priority DESC, t.id ASC
            `,
            args: [date, date]
        });

        // 4. Fetch Aux Data
        const sectionsRes = await db.execute('SELECT * FROM sections');
        const rulesRes = await db.execute('SELECT * FROM memory_rules');

        return NextResponse.json({ ...summary, tasks: tasksRes.rows, sections: sectionsRes.rows, rules: rulesRes.rows });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, tle_minutes, note, tomorrow_intent } = body;

        if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

        const db = await getDb();

        // Upsert Logic (SQLite ON CONFLICT)
        // LibSQL supports standard SQLite syntax
        await db.execute({
            sql: `
            INSERT INTO daily_logs (date, tle_minutes, note, tomorrow_intent)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                tle_minutes = COALESCE(excluded.tle_minutes, daily_logs.tle_minutes),
                note = COALESCE(excluded.note, daily_logs.note),
                tomorrow_intent = COALESCE(excluded.tomorrow_intent, daily_logs.tomorrow_intent)
            `,
            args: [
                date,
                tle_minutes !== undefined ? tle_minutes : null,
                note !== undefined ? note : null,
                tomorrow_intent !== undefined ? tomorrow_intent : null
            ]
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
    }
}
