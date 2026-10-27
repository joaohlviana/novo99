/** Client-side guard only. The server must independently validate consent. */
export function hasAdultConsent(values) {
  return values.get('adult') === 'on';
}
