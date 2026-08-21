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
  const region = body.region === 'intl' ? 'intl' : 'us';
  const name = String(body.name || '').trim();
  const city = String(body.city || '').trim();
  const type = body.type === 'empath-like' ? 'empath-like' : 'empath';
  const status = body.status === 'in-development' ? 'in-development' : 'live';
  const note = String(body.note || '').trim();
  const lat = body.lat != null && body.lat !== '' && !isNaN(parseFloat(body.lat)) ? parseFloat(body.lat) : null;
  const lon = body.lon != null && body.lon !== '' && !isNaN(parseFloat(body.lon)) ? parseFloat(body.lon) : null;

  const insert = { region, name, type, status, note, lat, lon, approx: false };

  if (region === 'intl') {
    const country = String(body.country || '').trim();
    if (!name || !country) {
      return NextResponse.json({ error: 'Name and country are required.' }, { status: 400 });
    }
    insert.country = country;
    insert.city = city || null;
    insert.state = null;
    insert.hawaii = false;
  } else {
    const state = String(body.state || '').trim().toUpperCase();
    if (!name || !city || !state) {
      return NextResponse.json({ error: 'Name, city, and state are required.' }, { status: 400 });
    }
    insert.city = city;
    insert.state = state;
    insert.hawaii = state === 'HI';
    insert.country = null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sites')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ site: data });
}
