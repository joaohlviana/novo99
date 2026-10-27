// Configuration and integrations are not validation; only report capabilities delivered.
export function capabilityStatus() {
  return { version: '1', auth: { email: false, google: false }, search: { enabled: false }, storage: { enabled: false }, billing: { enabled: false } };
}
