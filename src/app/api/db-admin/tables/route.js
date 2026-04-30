import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const results = await query('SHOW TABLES');
    const tables = results.map(row => Object.values(row)[0]);
    return NextResponse.json({ tables });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
