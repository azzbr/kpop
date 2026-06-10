import { createClient } from '@supabase/supabase-js';

// Public client-side credentials (publishable key — safe to ship in the bundle).
// Used ONLY for Realtime game rooms; no database tables are read or written.
const SUPABASE_URL = 'https://nldfgfrgmkjifikukbjc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vNElGeSLHrqVG6s3YW-xWw_XqjNUb1V';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 25 } },
});
