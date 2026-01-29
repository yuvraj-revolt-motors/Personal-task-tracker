import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { content } = await request.json();
        if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 });

        const db = await getDb();
        const info = await db.execute({ sql: 'INSERT INTO memory_rules (content) VALUES (?)', args: [content] });
        return NextResponse.json({ id: info.lastInsertRowid?.toString(), content });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        const db = await getDb();
        await db.execute({ sql: 'DELETE FROM memory_rules WHERE id = ?', args: [id] });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
