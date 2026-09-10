import { Request } from 'express';

/**
 * The profile a request is about.
 *
 * Four sources, in order:
 *
 * 1. an explicit `?profile=`, so the endpoint stays testable with curl;
 * 2. the `profile` HTTP header, which the Zapp endpoint config attaches from
 *    `user_account.profile` — the sturdiest of the three, since nothing that
 *    rewrites the url can disturb it;
 * 3. `X-VIEWER-ID`, the other name the same `user_account.profile` key is
 *    mapped to. Some endpoints declare one spelling, some the other, and a
 *    screen whose url cannot carry a parameter has nothing else to offer:
 *    `quick-brick-screen-form` refuses a url containing `{{...}}` outright,
 *    so the form feed's url must be static and the profile must ride in a
 *    header;
 * 4. the base64 `ctx` query param Zapp clients carry screen context in
 *    (`{"profile":"..."}`), which a url rewrite does drop.
 *
 * Returns '' when nothing names a profile. That is the app-wide PIN, used by
 * apps that gate everything behind one code — a mode, not a failure.
 */
export function getProfileFromRequest(
  req?: Request,
  explicit?: string,
): string {
  if (explicit) {
    return explicit;
  }

  // The Zapp endpoint declares user_account.profile as an HTTP custom header
  // renamed `profile`, so it rides on every request that endpoint governs —
  // and unlike ctx it is unaffected by anything rewriting the url.
  const header = req?.headers?.['profile'];

  if (typeof header === 'string' && header) {
    return header;
  }

  // Express lowercases header names, so `X-VIEWER-ID` arrives like this.
  // "undefined" as a literal string is what the client sends when the key
  // resolved to nothing — treating it as a profile id would look up a
  // profile named "undefined" and quietly answer about nobody.
  const viewerId = req?.headers?.['x-viewer-id'];

  if (
    typeof viewerId === 'string' &&
    viewerId &&
    viewerId !== 'undefined' &&
    viewerId !== 'null'
  ) {
    return viewerId;
  }

  const raw = req?.query?.ctx;

  if (typeof raw !== 'string' || !raw) {
    return '';
  }

  try {
    // Buffer tolerates the missing "=" padding Zapp clients strip.
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const profile = (JSON.parse(decoded) as { profile?: unknown })?.profile;

    return profile === undefined || profile === null ? '' : String(profile);
  } catch {
    return '';
  }
}
