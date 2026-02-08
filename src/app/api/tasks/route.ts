import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId } from '@/lib/auth-util';

export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { date, title, priority, habit_id, section_id, note, estimated_time } = body;

        const db = await getDb();
        await db.execute({
            sql: 'INSERT INTO tasks (user_id, date, title, priority, habit_id, section_id, note, estimated_time, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
            args: [userId, date, title, priority, habit_id || null, section_id || null, note || null, estimated_time || null]
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("POST /api/tasks Error:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, completed, title, priority, note, estimated_time, date, section_id } = body;

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const db = await getDb();

        if (completed !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?', args: [completed ? 1 : 0, id, userId] });
        }
        if (title !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET title = ? WHERE id = ? AND user_id = ?', args: [title, id, userId] });
        }
        if (priority !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET priority = ? WHERE id = ? AND user_id = ?', args: [priority, id, userId] });
        }
        if (note !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET note = ? WHERE id = ? AND user_id = ?', args: [note, id, userId] });
        }
        if (estimated_time !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET estimated_time = ? WHERE id = ? AND user_id = ?', args: [estimated_time, id, userId] });
        }
        if (date !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET date = ? WHERE id = ? AND user_id = ?', args: [date, id, userId] });
        }
        if (section_id !== undefined) {
            await db.execute({ sql: 'UPDATE tasks SET section_id = ? WHERE id = ? AND user_id = ?', args: [section_id, id, userId] });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, is_habit_template } = body;

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const db = await getDb();

        if (is_habit_template) {
            // Archive habit
            await db.execute({ sql: 'UPDATE habits SET is_archived = 1 WHERE id = ? AND user_id = ?', args: [id, userId] });
        } else {
            // Delete specific task
            await db.execute({ sql: 'DELETE FROM tasks WHERE id = ? AND user_id = ?', args: [id, userId] });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
