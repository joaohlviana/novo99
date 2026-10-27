// Deliberately limited to the new project. No secret/service key is accepted.
export function supabaseConfig(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url !== 'https://rycaxboqkkiopjdecgld.supabase.co' || typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  return { url, key };
}
