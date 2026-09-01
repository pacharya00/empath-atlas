import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

// Read-only counterpart to /api/sites, reachable without the session cookie
// (see middleware.js) for the public /embed page. No POST/PATCH here.
export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('sites').select('*').order('id', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sites: data });
}
