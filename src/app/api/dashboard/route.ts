import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId } from '@/lib/auth-util';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDb();

        // Parallel execution of all dashboard queries (Filtered by user_id)
        const [
            summaryRes,
            gymRes,
            habitsRes,
            habitLogsRes,
            sectionsRes,
            buyingItemsRes,
            buyingCategoriesRes,
            historyRes,
            userRes,
            financesRes
        ] = await Promise.all([
            db.execute({ sql: 'SELECT * FROM daily_logs WHERE date = ? AND user_id = ?', args: [date, userId] }),
            db.execute({ sql: 'SELECT * FROM workout_schedule WHERE user_id = ? ORDER BY day_index', args: [userId] }),
            db.execute({ sql: 'SELECT * FROM habits WHERE user_id = ?', args: [userId] }),
            db.execute({ sql: 'SELECT habit_id, completed, time_spent, note FROM habit_logs WHERE date = ? AND user_id = ?', args: [date, userId] }),
            db.execute({ sql: 'SELECT * FROM sections WHERE user_id = ?', args: [userId] }),
            db.execute({ sql: 'SELECT * FROM buying_list WHERE user_id = ?', args: [userId] }),
            db.execute({ sql: 'SELECT * FROM buying_categories WHERE user_id = ?', args: [userId] }),
            db.execute({ sql: 'SELECT date, dsa_done, dev_done, gym_done FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 100', args: [userId] }),
            db.execute({ sql: 'SELECT id, email, name FROM users WHERE id = ?', args: [userId] }),
            db.execute({ sql: 'SELECT * FROM finances WHERE user_id = ? ORDER BY created_at DESC', args: [userId] })
        ]);

        const user = userRes.rows[0];

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
            WHERE ((t.date = ?) OR (t.date < ? AND t.completed = 0)) AND t.user_id = ?
            ORDER BY t.priority DESC, t.id ASC
            `,
            args: [date, date, userId]
        });

        // 4. Streak Calculation
        const history = historyRes.rows as any[];

        // Fetch all habit logs for streak calculation (Limit to last 100 entries per user for perf)
        const allHabitLogsRes = await db.execute({
            sql: 'SELECT habit_id, date, completed, created_at FROM habit_logs WHERE user_id = ? ORDER BY created_at DESC',
            args: [userId]
        });
        const allHabitLogs = allHabitLogsRes.rows;

        const calcDynamicStreak = (id: number) => {
            const hLogs = allHabitLogs.filter((l: any) => l.habit_id === id && l.completed === 1);
            if (hLogs.length === 0) return { streak: 0, at_risk: false, expires_at: null };

            const now = new Date();
            const rawCreatedAt = hLogs[0].created_at;
            if (!rawCreatedAt) return { streak: 0, at_risk: false, expires_at: null };

            const lastLogTime = new Date(rawCreatedAt as string + 'Z');
            if (isNaN(lastLogTime.getTime())) return { streak: 0, at_risk: false, expires_at: null };

            const hoursSinceLast = (now.getTime() - lastLogTime.getTime()) / (1000 * 3600);

            if (hoursSinceLast > 48) return { streak: 0, at_risk: false, expires_at: null };

            const getDayDiff = (d1Str: string, d2Str: string) => {
                const date1 = new Date(d1Str);
                const date2 = new Date(d2Str);
                return Math.round((date1.getTime() - date2.getTime()) / (1000 * 3600 * 24));
            };

            // 2. Count consecutive days
            // Sort by date descending to ensure uniqueDays[0] is most recent
            const uniqueDays = Array.from(new Set(hLogs.map(l => String(l.date)))).filter(d => d !== 'null' && d !== '').sort().reverse();
            if (uniqueDays.length === 0) return { streak: 0, at_risk: false, expires_at: null };

            if (getDayDiff(date, uniqueDays[0]) > 1) return { streak: 0, at_risk: false, expires_at: null };

            let count = 1;
            let lastD = uniqueDays[0];
            for (let i = 1; i < uniqueDays.length; i++) {
                const currD = uniqueDays[i];
                if (getDayDiff(lastD, currD) === 1) {
                    count++;
                    lastD = currD;
                } else break;
            }

            const expiresAt = new Date(lastLogTime.getTime() + (24 * 3600 * 1000));
            const atRisk = hoursSinceLast > 20;

            return {
                streak: count,
                at_risk: atRisk,
                expires_at: isNaN(expiresAt.getTime()) ? null : expiresAt.toISOString()
            };
        };

        const calcPerformanceStreak = (field: string) => {
            const todayStr = date;
            const refDate = new Date(date);
            const yesterdayDate = new Date(refDate);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
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
            const getDayDiff = (d1Str: string, d2Str: string) => {
                const date1 = new Date(d1Str);
                const date2 = new Date(d2Str);
                return Math.round((date1.getTime() - date2.getTime()) / (1000 * 3600 * 24));
            };

            let lastDate = history[streakStart].date;
            for (let i = streakStart + 1; i < history.length; i++) {
                if (history[i][field]) {
                    const currDate = history[i].date;
                    if (getDayDiff(lastDate, currDate) === 1) {
                        streak++;
                        lastDate = currDate;
                    } else break;
                } else break;
            }
            return streak;
        };

        // Final processed habit list with DYNAMIC streaks
        const finalHabitList = habitList.map((h: any) => {
            const sInfo = calcDynamicStreak(h.id);
            return {
                ...h,
                streak: sInfo.streak,
                streak_at_risk: sInfo.at_risk,
                streak_expires_at: sInfo.expires_at
            };
        });

        return NextResponse.json({
            dailyParams: {
                ...summary,
                tasks: tasksRes.rows,
                sections: sectionsRes.rows,
                streaks: {
                    dsa: calcPerformanceStreak('dsa_done'),
                    dev: calcPerformanceStreak('dev_done'),
                    gym: calcPerformanceStreak('gym_done')
                },
                workout_schedule: gymRes.rows
            },
            habits: finalHabitList,
            sections: sectionsRes.rows,
            user,
            buyingList: buyingItemsRes.rows,
            buyCategories: buyingCategoriesRes.rows,
            finances: financesRes.rows
        });

    } catch (e) {
        console.error("Dashboard Init Error:", e);
        return NextResponse.json({ error: 'Failed to fast-load dashboard' }, { status: 500 });
    }
}
