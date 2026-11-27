import {
  buildFormData,
  buildOwnerNudge,
  buildParentalControls,
  isAllowed,
  OWNER_NUDGE,
  PERMISSIONS,
} from './ParentalControlsBuilder';

describe('buildParentalControls', () => {
  const profile = (denied: Record<string, boolean> = {}) =>
    ({ id: 'kid', extensions: { denied_actions: denied } }) as any;

  const fields = (entry?: any) =>
    buildParentalControls(entry).filter((p) => p.type === 'checkBox');

  it('offers the five permissions the requirements name', () => {
    expect(fields(profile()).map((p) => p.id)).toEqual([
      'allowComment',
      'allowChangePicture',
      'allowChangeName',
      'allowOfflineDownload',
      'allowFavorites',
    ]);
  });

  // The screen reads values from the entry, never from the form, so a value
  // written here would look like a prefilled box that renders empty.
  it('declares the fields without claiming to carry their values', () => {
    expect(
      fields(profile({ comment: true })).every(
        (p) => !('value' in (p.options as any)),
      ),
    ).toBe(true);
  });

  it('names the preset the form screen renders a checkbox with', () => {
    expect(
      fields(profile()).every((p) => p.preset === 'FormMultiSelectGroup'),
    ).toBe(true);
  });

  it('heads the section so it reads as a group', () => {
    const [first] = buildParentalControls(profile());

    expect(first.type).toBe('label');
    expect((first.options as any).title).toBe('Parental Controls');
  });

  it('names every permission it offers', () => {
    expect(PERMISSIONS.map((p) => p.title)).toEqual(
      fields(profile()).map((p) => (p.options as any).title),
    );
  });
});

describe('buildFormData', () => {
  const profile = (denied: Record<string, boolean> = {}) =>
    ({ id: 'kid', extensions: { denied_actions: denied } }) as any;

  // The list records what is forbidden; the screen offers what is allowed.
  // Getting this backwards grants what was meant to be denied, quietly.
  it('ticks a permission the profile is not denied', () => {
    expect(buildFormData(profile({ comment: false })).allowComment).toBe(true);
  });

  it('unticks one it is denied', () => {
    expect(buildFormData(profile({ change_name: true })).allowChangeName).toBe(
      false,
    );
  });

  // A profile the list says nothing about is not a profile denied everything.
  it('treats a profile with no denied actions as allowed', () => {
    expect(Object.values(buildFormData(undefined)).every(Boolean)).toBe(true);
  });

  // The form declares the fields and the entry fills them; a key that matches
  // no property is ignored, so the two lists have to be the same list.
  it('keys the values by the ids the form declares', () => {
    expect(Object.keys(buildFormData(profile()))).toEqual(
      PERMISSIONS.map((p) => p.id),
    );
  });
});

describe('buildOwnerNudge', () => {
  // Restrictions belong to a child's profile: an owner restricting themselves
  // protects nobody, so the section becomes a suggestion.
  it('replaces the controls with a note', () => {
    const [note] = buildOwnerNudge();

    expect(note.type).toBe('label');
    expect((note.options as any).description).toBe(OWNER_NUDGE);
  });

  it('takes the wording it is given', () => {
    const [note] = buildOwnerNudge('Ours until yours arrives.');

    expect((note.options as any).description).toBe('Ours until yours arrives.');
  });
});

describe('isAllowed', () => {
  it('reads a missing profile as denying nothing', () => {
    expect(isAllowed(undefined, 'comment')).toBe(true);
  });

  it('only `true` denies', () => {
    const entry = {
      id: 'kid',
      extensions: { denied_actions: { comment: 'yes', bookmark: true } },
    } as any;

    expect(isAllowed(entry, 'comment')).toBe(true);
    expect(isAllowed(entry, 'bookmark')).toBe(false);
  });
});
