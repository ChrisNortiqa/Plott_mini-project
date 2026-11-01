/* Supabase project configuration.
   1. Create a project at https://supabase.com
   2. Paste your Project URL and anon/public key below.
   Never put a service_role key in browser JavaScript. */
window.PLOTT_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
window.PLOTT_SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
window.plottSupabaseReady = () =>
  window.PLOTT_SUPABASE_URL.startsWith("https://") &&
  !window.PLOTT_SUPABASE_URL.includes("YOUR_PROJECT") &&
  window.PLOTT_SUPABASE_ANON_KEY &&
  !window.PLOTT_SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
window.plottClient = window.supabase && window.plottSupabaseReady()
  ? window.supabase.createClient(window.PLOTT_SUPABASE_URL, window.PLOTT_SUPABASE_ANON_KEY)
  : null;
