import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Create Task (Ad-hoc) OR Habit
export async function POST(request: Request) {
    try {
        const { date, title, priority, type, section_id } = await request.json();

        const db = await getDb();

        if (type === 'habit') {
            const info = await db.execute({
                sql: 'INSERT INTO habits (title, priority) VALUES (?, ?)',
                args: [title, priority || 1]
            });
            if (date) {
                await db.execute({
                    sql: 'INSERT INTO tasks (date, title, priority, habit_id, completed) VALUES (?, ?, ?, ?, 0)',
                    args: [date, title, priority || 1, info.lastInsertRowid]
                });
            }
            return NextResponse.json({ success: true });
        } else {
            if (!date || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
            const info = await db.execute({
                sql: 'INSERT INTO tasks (date, title, priority, section_id, completed) VALUES (?, ?, ?, ?, 0)',
                args: [date, title, priority || 1, section_id || null]
            });
            // Convert BigInt to number/string for JSON serialization if needed, though simple ints are fine
            return NextResponse.json({ id: info.lastInsertRowid.toString(), date, title, priority: priority || 1, section_id, completed: 0 });
        }
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
}

// Update Task (Completion, Note, Priority)
export async function PATCH(request: Request) {
    try {
        const { id, completed, note, priority } = await request.json();
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const db = await getDb();

        const updates = [];
        const params = [];

        if (completed !== undefined) { updates.push('completed = ?'); params.push(completed ? 1 : 0); }
        if (note !== undefined) { updates.push('note = ?'); params.push(note); }
        if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }

        params.push(id);

        if (updates.length > 0) {
            await db.execute({
                sql: `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
                args: params
            });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

// Delete Task (or Archive Habit)
export async function DELETE(request: Request) {
    try {
        const { id, is_habit_template } = await request.json();
        const db = await getDb();

        if (is_habit_template) {
            await db.execute({ sql: 'UPDATE habits SET is_archived = 1 WHERE id = ?', args: [id] });
        } else {
            await db.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [id] });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
