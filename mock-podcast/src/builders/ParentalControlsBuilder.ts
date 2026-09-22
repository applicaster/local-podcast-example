import { ProfileEntry } from '../modules/profiles/profiles.repository';

/**
 * The five permissions the requirements name, in the order they are listed
 * there, beside the key each one already has in `denied_actions`.
 *
 * The customer's data says what a profile may **not** do; the screen asks what
 * it **may**. The inversion lives here, in one place, because getting it
 * backwards silently grants what was meant to be denied.
 */
export const PERMISSIONS = [
  { id: 'allowComment', deniedKey: 'comment', title: 'Allow commenting' },
  {
    id: 'allowChangePicture',
    deniedKey: 'change_picture',
    title: 'Allow changing profile picture',
  },
  {
    id: 'allowChangeName',
    deniedKey: 'change_name',
    title: 'Allow changing profile display name',
  },
  {
    id: 'allowOfflineDownload',
    deniedKey: 'offline_download',
    title: 'Allow offline downloads',
  },
  { id: 'allowFavorites', deniedKey: 'bookmark', title: 'Allow favorites' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['deniedKey'];

type FormProperty = Record<string, unknown>;

const deniedActionsOf = (entry?: ProfileEntry): Record<string, unknown> => {
  const denied = entry?.extensions?.denied_actions;

  return denied && typeof denied === 'object'
    ? (denied as Record<string, unknown>)
    : {};
};

/** `true` means the profile may do it, which is the opposite of what we store. */
export const isAllowed = (entry: ProfileEntry | undefined, key: string) =>
  deniedActionsOf(entry)[key] !== true;

/**
 * The Parental Controls section the account owner sees on another profile.
 *
 * The customer's form has none of this — it carries an avatar picker and a
 * display name — so the whole section is ours, built from what their profile
 * list already says about the profile. That makes it a proposal as much as a
 * stand: this is the shape we are asking their form to grow.
 *
 * Checkboxes are pre-ticked from `denied_actions`, inverted: the list records
 * what is forbidden, the screen offers what is allowed.
 */
export function buildParentalControls(
  entry: ProfileEntry | undefined,
): FormProperty[] {
  return [
    {
      id: 'parentalControlsHeading',
      type: 'label',
      options: {
        title: 'Parental Controls',
        description: 'What this profile may do on this account.',
      },
    },
    // No value here, deliberately. A form property declares a field; the
    // screen fills it from `extensions.form_data` on the entry that navigated
    // to it (see `buildFormData`). `options.value` is read by nobody, and
    // writing one makes a form look prefilled that is not.
    ...PERMISSIONS.map((permission) => ({
      id: permission.id,
      type: 'checkBox',
      preset: 'FormMultiSelectGroup',
      options: { title: permission.title },
    })),
  ];
}

/**
 * What the owner sees on their own profile instead of the section above.
 *
 * The requirement asks for a nudge rather than controls — restrictions belong
 * to a child's profile, and an owner restricting themselves protects nobody.
 * The wording is a placeholder until the product team sends theirs.
 */
export const OWNER_NUDGE =
  'Parental controls are set on each child’s profile. Create a profile for ' +
  'every child so their restrictions can be set separately.';

export function buildOwnerNudge(message = OWNER_NUDGE): FormProperty[] {
  return [
    {
      id: 'parentalControlsOwnerNote',
      type: 'label',
      options: { title: 'Parental Controls', description: message },
    },
  ];
}

/**
 * The starting state of the section above, in the shape the form screen reads.
 *
 * `quick-brick-screen-form` takes every value from `entry.extensions.form_data`
 * on the entry that opened the screen, keyed by property id — never from the
 * form config. So the checkboxes are described by the form and filled in by the
 * profile list, and both have to agree on the ids, which is why both come from
 * `PERMISSIONS`.
 *
 * Inverted here too: the list says what is denied, the screen offers what is
 * allowed.
 */
export function buildFormData(
  entry: ProfileEntry | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    PERMISSIONS.map((permission) => [
      permission.id,
      isAllowed(entry, permission.deniedKey),
    ]),
  );
}
