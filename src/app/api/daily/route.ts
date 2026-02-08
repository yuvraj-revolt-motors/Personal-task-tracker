import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId } from '@/lib/auth-util';

export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    try {
        const db = await getDb();

        // 1. Get Daily Summary
        const summaryRes = await db.execute({ sql: 'SELECT * FROM daily_logs WHERE date = ? AND user_id = ?', args: [date, userId] });
        let summary: any = summaryRes.rows[0];
        if (!summary) summary = { date, tle_minutes: 0, note: '', tomorrow_intent: '', dsa_done: 0, dev_done: 0, gym_done: 0 };

        // 2. STREAK CALCULATION
        const historyRes = await db.execute({ sql: 'SELECT date, dsa_done, dev_done, gym_done FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 100', args: [userId] });
        const history = historyRes.rows as any[];

        const calcStreak = (field: string) => {
            const todayStr = date;
            const refDate = new Date(date);
            const yesterdayDate = new Date(refDate);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

            let streakStart = -1;
            for (let i = 0; i < history.length; i++) {
                if (history[i][field]) {
                    if (history[i].date === todayStr || history[i].date === yesterdayStr) {
                        streakStart = i;
                        break;
                    } else {
                        return 0;
                    }
                }
            }

            if (streakStart === -1) return 0;

            let streak = 1;
            const getDayDiff = (d1Str: string, d2Str: string) => {
                const date1 = new Date(d1Str);
                const date2 = new Date(d2Str);
                return Math.round((date1.getTime() - date2.getTime()) / (1000 * 3600 * 24));
            };

            let lastDate = String(history[streakStart].date);
            for (let i = streakStart + 1; i < history.length; i++) {
                if (history[i][field]) {
                    const currDate = String(history[i].date);
                    if (getDayDiff(lastDate, currDate) === 1) {
                        streak++;
                        lastDate = currDate;
                    } else break;
                } else break;
            }
            return streak;
        };

        const streaks = {
            dsa: calcStreak('dsa_done'),
            dev: calcStreak('dev_done'),
            gym: calcStreak('gym_done')
        };

        // 3. GYM SCHEDULE
        const gymRes = await db.execute({ sql: 'SELECT * FROM workout_schedule WHERE user_id = ? ORDER BY day_index', args: [userId] });

        // 4. HABITS & TASKS
        const habitsRes = await db.execute({ sql: 'SELECT * FROM habits WHERE user_id = ?', args: [userId] });
        const habits = habitsRes.rows;

        const existingTasksRes = await db.execute({ sql: 'SELECT habit_id FROM tasks WHERE date = ? AND habit_id IS NOT NULL AND user_id = ?', args: [date, userId] });
        const existingIds = new Set(existingTasksRes.rows.map((t: any) => t.habit_id));
        const newHabits = habits.filter((h: any) => !existingIds.has(h.id));
        if (newHabits.length > 0) {
            const batch = newHabits.map((h: any) => ({
                sql: 'INSERT INTO tasks (user_id, date, title, priority, habit_id, completed) VALUES (?, ?, ?, ?, ?, 0)',
                args: [userId, date, h.title, h.priority, h.id]
            }));
            if (batch.length > 0) await db.batch(batch, 'write');
        }

        const tasksRes = await db.execute({
            sql: `
            SELECT t.*, s.title as section_title 
            FROM tasks t
            LEFT JOIN sections s ON t.section_id = s.id
            WHERE ((t.date = ?) OR (t.date < ? AND t.completed = 0)) AND t.user_id = ?
            ORDER BY t.priority DESC, t.id ASC
            `,
            args: [date, date, userId]
        });

        const sectionsRes = await db.execute({ sql: 'SELECT * FROM sections WHERE user_id = ?', args: [userId] });
        const rulesRes = await db.execute({ sql: 'SELECT * FROM memory_rules WHERE user_id = ?', args: [userId] });

        return NextResponse.json({
            ...summary,
            tasks: tasksRes.rows,
            sections: sectionsRes.rows,
            rules: rulesRes.rows,
            streaks,
            workout_schedule: gymRes.rows
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { date, tle_minutes, note, tomorrow_intent } = body;

        if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

        const db = await getDb();

        await db.execute({
            sql: `
            INSERT INTO daily_logs (
                user_id, date, tle_minutes, note, tomorrow_intent, 
                dsa_done, dev_done, gym_done, work_done, secondary_work_mins, focus_done,
                dsa_time, dsa_note, dev_time, dev_note, gym_time, gym_note
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET
                tle_minutes = COALESCE(excluded.tle_minutes, daily_logs.tle_minutes),
                note = COALESCE(excluded.note, daily_logs.note),
                tomorrow_intent = COALESCE(excluded.tomorrow_intent, daily_logs.tomorrow_intent),
                dsa_done = COALESCE(excluded.dsa_done, daily_logs.dsa_done),
                dev_done = COALESCE(excluded.dev_done, daily_logs.dev_done),
                gym_done = COALESCE(excluded.gym_done, daily_logs.gym_done),
                work_done = COALESCE(excluded.work_done, daily_logs.work_done),
                secondary_work_mins = COALESCE(excluded.secondary_work_mins, daily_logs.secondary_work_mins),
                focus_done = COALESCE(excluded.focus_done, daily_logs.focus_done),
                dsa_time = COALESCE(excluded.dsa_time, daily_logs.dsa_time),
                dsa_note = COALESCE(excluded.dsa_note, daily_logs.dsa_note),
                dev_time = COALESCE(excluded.dev_time, daily_logs.dev_time),
                dev_note = COALESCE(excluded.dev_note, daily_logs.dev_note),
                gym_time = COALESCE(excluded.gym_time, daily_logs.gym_time),
                gym_note = COALESCE(excluded.gym_note, daily_logs.gym_note)
            `,
            args: [
                userId, date,
                tle_minutes ?? null, note ?? null, tomorrow_intent ?? null,
                body.dsa_done ?? null, body.dev_done ?? null, body.gym_done ?? null,
                body.work_done ?? null, body.secondary_work_mins ?? null, body.focus_done ?? null,
                body.dsa_time ?? null, body.dsa_note ?? null,
                body.dev_time ?? null, body.dev_note ?? null,
                body.gym_time ?? null, body.gym_note ?? null
            ]
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
