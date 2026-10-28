import { isAuthApiError, isAuthWeakPasswordError } from '@supabase/supabase-js';

// Only explicit HTTP rejections from Auth are treated as confirmed failures.
// Timeouts, transport failures, malformed replies and server errors may have
// occurred after the provider processed the request, so remain unknown.
export function signupErrorState(error) {
  if ((isAuthApiError(error) || isAuthWeakPasswordError(error)) &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status)) return 'error';
  return 'unconfirmed';
}
