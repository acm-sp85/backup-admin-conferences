import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { sql } = await req.json();
    if (!sql) return NextResponse.json({ error: 'No SQL provided' }, { status: 400 });

    const result = await query(sql);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
