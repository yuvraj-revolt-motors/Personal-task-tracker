import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId } from '@/lib/auth-util';

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = await getDb();
        const rs = await db.execute({
            sql: 'SELECT * FROM finances WHERE user_id = ? ORDER BY created_at DESC',
            args: [userId]
        });
        return NextResponse.json(rs.rows);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { title, amount, type, total_months, paid_months, note } = await req.json();
        const db = await getDb();
        await db.execute({
            sql: 'INSERT INTO finances (user_id, title, amount, type, total_months, paid_months, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
            args: [userId, title, amount || 0, type || 'payment', total_months || 0, paid_months || 0, note || '']
        });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id, title, amount, type, total_months, paid_months, note, last_paid_month } = await req.json();
        const db = await getDb();

        const updates: string[] = [];
        const args: any[] = [];

        if (title !== undefined) { updates.push('title = ?'); args.push(title); }
        if (amount !== undefined) { updates.push('amount = ?'); args.push(amount); }
        if (type !== undefined) { updates.push('type = ?'); args.push(type); }
        if (total_months !== undefined) { updates.push('total_months = ?'); args.push(total_months); }
        if (paid_months !== undefined) { updates.push('paid_months = ?'); args.push(paid_months); }
        if (note !== undefined) { updates.push('note = ?'); args.push(note); }
        if (last_paid_month !== undefined) { updates.push('last_paid_month = ?'); args.push(last_paid_month); }

        if (updates.length > 0) {
            args.push(id, userId);
            await db.execute({
                sql: `UPDATE finances SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                args
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await req.json();
        const db = await getDb();
        await db.execute({
            sql: 'DELETE FROM finances WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
