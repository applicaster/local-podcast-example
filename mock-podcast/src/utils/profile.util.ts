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
/**
 * Whether a header value names a profile at all.
 *
 * A client whose `user_account.profile` resolved to nothing still sends the
 * header, carrying the literal "undefined" — which is what an app that has not
 * been in a profile yet sends on every request. Taking it at face value looks
 * up a profile named "undefined" and quietly answers about nobody.
 */
const isProfileId = (value: string): boolean =>
  !!value && value !== 'undefined' && value !== 'null';

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
  //
  // Express lowercases header names, so `X-VIEWER-ID` arrives like this.
  for (const name of ['profile', 'x-viewer-id']) {
    const value = req?.headers?.[name];

    if (typeof value === 'string' && isProfileId(value)) {
      return value;
    }
  }

  return readProfileFromCtx(req?.query?.ctx);
}

/**
 * The profile inside the base64 `ctx` query param.
 *
 * Exported because the profile form has to read it without the header
 * fallbacks above: a form is about the profile being edited, and the headers
 * name the viewer, who is the parent while a child is edited.
 */
export function readProfileFromCtx(raw: unknown): string {
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
