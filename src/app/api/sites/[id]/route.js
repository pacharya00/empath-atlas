import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function PATCH(request, { params }) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sites')
    .update({ status: 'live' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ site: data });
}
