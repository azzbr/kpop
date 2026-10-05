import { RealtimeClient } from '@supabase/realtime-js';

// Public client-side credentials (publishable key — safe to ship in the bundle).
// Used ONLY for Realtime game rooms (broadcast + presence); no database tables are read or
// written. Just the Realtime client, not the whole supabase-js SDK (auth, database, storage),
// which saved ~150 kB on the iPad.
const SUPABASE_URL = 'https://nldfgfrgmkjifikukbjc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vNElGeSLHrqVG6s3YW-xWw_XqjNUb1V';

export const realtime = new RealtimeClient(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1`, {
  params: { apikey: SUPABASE_KEY, eventsPerSecond: 25 },
  // Same as supabase-js with no signed-in user: the key doubles as the access token.
  accessToken: async () => SUPABASE_KEY,
});
