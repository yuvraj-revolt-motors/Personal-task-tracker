import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-key-change-me');

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    try {
        const db = await getDb();

        // Auth check (mirroring middleware)
        let user = null;
        try {
            const token = (await cookies()).get('token')?.value;
            if (token) {
                const { payload } = await jwtVerify(token, JWT_SECRET);
                if (payload && payload.uid) {
                    const userRes = await db.execute({ sql: 'SELECT id, email, name FROM users WHERE id = ?', args: [payload.uid as string] });
                    user = userRes.rows[0];
                }
            }
        } catch (e) { /* ignore auth failure for main data load */ }

        // Parallel execution of all dashboard queries
        const [
            summaryRes,
            gymRes,
            habitsRes,
            habitLogsRes,
            sectionsRes,
            buyingItemsRes,
            buyingCategoriesRes,
            historyRes
        ] = await Promise.all([
            db.execute({ sql: 'SELECT * FROM daily_logs WHERE date = ?', args: [date] }),
            db.execute('SELECT * FROM workout_schedule ORDER BY day_index'),
            db.execute('SELECT * FROM habits'),
            db.execute({ sql: 'SELECT habit_id, completed, time_spent, note FROM habit_logs WHERE date = ?', args: [date] }),
            db.execute('SELECT * FROM sections'),
            db.execute('SELECT * FROM buying_list'),
            db.execute('SELECT * FROM buying_categories'),
            db.execute('SELECT date, dsa_done, dev_done, gym_done FROM daily_logs ORDER BY date DESC LIMIT 100')
        ]);

        // 1. Process Daily Summary
        let summary: any = summaryRes.rows[0];
        if (!summary) summary = { date, tle_minutes: 0, note: '', tomorrow_intent: '', dsa_done: 0, dev_done: 0, gym_done: 0 };

        // 2. Process Habits with Logs
        const logsMap = new Map();
        habitLogsRes.rows.forEach((l: any) => logsMap.set(l.habit_id, l));

        const habitList = habitsRes.rows.map((h: any) => ({
            ...h,
            ...(logsMap.get(h.id) || { completed: 0, time_spent: 0, note: '' })
        }));

        // 3. Process Tasks (Filtered by date, matching api/daily logic)
        const tasksRes = await db.execute({
            sql: `
            SELECT t.*, s.title as section_title 
            FROM tasks t
            LEFT JOIN sections s ON t.section_id = s.id
            WHERE (t.date = ?) OR (t.date < ? AND t.completed = 0)
            ORDER BY t.priority DESC, t.id ASC
            `,
            args: [date, date]
        });

        // 4. Streak Calculation
        const history = historyRes.rows as any[];
        const calcStreak = (field: string) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
            let streakStart = -1;
            for (let i = 0; i < history.length; i++) {
                if (history[i][field]) {
                    if (history[i].date === todayStr || history[i].date === yesterdayStr) {
                        streakStart = i; break;
                    } else return 0;
                }
            }
            if (streakStart === -1) return 0;
            let streak = 1;
            let lastDate = new Date(history[streakStart].date);
            for (let i = streakStart + 1; i < history.length; i++) {
                if (history[i][field]) {
                    const currDate = new Date(history[i].date);
                    const diff = (lastDate.getTime() - currDate.getTime()) / (1000 * 3600 * 24);
                    if (diff >= 0.9 && diff <= 1.1) { streak++; lastDate = currDate; } else break;
                } else break;
            }
            return streak;
        };

        return NextResponse.json({
            dailyParams: {
                ...summary,
                tasks: tasksRes.rows,
                sections: sectionsRes.rows,
                streaks: { dsa: calcStreak('dsa_done'), dev: calcStreak('dev_done'), gym: calcStreak('gym_done') },
                workout_schedule: gymRes.rows
            },
            habits: habitList,
            sections: sectionsRes.rows,
            user,
            buyingList: buyingItemsRes.rows,
            buyCategories: buyingCategoriesRes.rows
        });

    } catch (e) {
        console.error("Dashboard Init Error:", e);
        return NextResponse.json({ error: 'Failed to fast-load dashboard' }, { status: 500 });
    }
}
