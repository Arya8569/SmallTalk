import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ status: 'error', message: 'DATABASE_URL missing' }, { status: 500 });
    }

    const sql = neon(dbUrl);
    const result = await sql`SELECT 1 as connected;`;
    return NextResponse.json({ status: 'connected', result });
  } catch (error: any) {
    console.error('Neon health check failed:', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
