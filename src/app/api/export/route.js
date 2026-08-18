import { getSupabaseClient } from '@/lib/supabase';

const COLUMNS = ['id', 'region', 'name', 'city', 'state', 'country', 'type', 'status', 'note', 'approx', 'hawaii', 'lat', 'lon', 'created_at'];

function csvEscape(value) {
  const str = String(value == null ? '' : value);
  return '"' + str.replace(/"/g, '""') + '"';
}

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('sites').select('*').order('id', { ascending: true });
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const lines = [COLUMNS, ...data.map((row) => COLUMNS.map((col) => row[col]))]
    .map((r) => r.map(csvEscape).join(','))
    .join('\r\n');

  return new Response(lines, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv;charset=utf-8;',
      'Content-Disposition': 'attachment; filename="empath-atlas-full-master-list.csv"',
    },
  });
}
