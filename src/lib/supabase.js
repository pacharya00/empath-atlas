import { createClient } from '@supabase/supabase-js';

// Server-only client using the service-role key. Never import this from a
// client component — it must stay inside API routes / server components.
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
