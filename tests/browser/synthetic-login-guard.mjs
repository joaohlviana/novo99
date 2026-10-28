// Accept only the one explicitly generated synthetic credential pair. Never
// print the body: this runs at the network boundary before a provider call.
export function isExpectedSyntheticLogin(raw, email, password) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.keys(value).sort().join(',') !== 'email,gotrue_meta_security,password') return false;
    if (value.email !== email || value.password !== password) return false;
    const metadata = value.gotrue_meta_security;
    return !!metadata && typeof metadata === 'object' && !Array.isArray(metadata) && Object.keys(metadata).length === 0;
  } catch { return false; }
}
