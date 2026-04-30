import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get('table');
  
  if (!table) return NextResponse.json({ error: 'No table specified' }, { status: 400 });

  try {
    const rows = await query(`SELECT * FROM \`${table}\` LIMIT 100`);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
