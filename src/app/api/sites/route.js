import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('sites').select('*').order('id', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sites: data });
}

export async function POST(request) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  const city = String(body.city || '').trim();
  const state = String(body.state || '').trim().toUpperCase();
  const type = body.type === 'empath-like' ? 'empath-like' : 'empath';
  const note = String(body.note || '').trim();
  const lat = body.lat != null && body.lat !== '' && !isNaN(parseFloat(body.lat)) ? parseFloat(body.lat) : null;
  const lon = body.lon != null && body.lon !== '' && !isNaN(parseFloat(body.lon)) ? parseFloat(body.lon) : null;
  const hawaii = state === 'HI';

  if (!name || !city || !state) {
    return NextResponse.json({ error: 'Name, city, and state are required.' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sites')
    .insert({
      region: 'us',
      name,
      city,
      state,
      type,
      status: 'live',
      note,
      lat,
      lon,
      hawaii,
      approx: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ site: data });
}
