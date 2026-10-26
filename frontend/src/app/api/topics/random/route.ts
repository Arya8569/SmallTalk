import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { categories_filter, exclude_ids = [] } = await req.json();
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 500 });
    }

    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT id, category, prompt 
      FROM get_random_topic(${categories_filter}::text[], ${exclude_ids}::int[])
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Error fetching topic from Neon:', error);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
