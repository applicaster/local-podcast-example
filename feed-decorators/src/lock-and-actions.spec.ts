import { ActionsBuilder } from './actions-builder';
import { EntryBuilder } from './entry-builder';
import { validateActionPayload } from './action-validators';

describe('EntryBuilder.asActionCell', () => {
  const cell = () =>
    new EntryBuilder(new ActionsBuilder(), {
      id: 'e1',
      type: { value: 'audio-detail' },
      link: { href: 'https://cms/audio-video/1', rel: 'self' },
    });

  // A plain cell navigates by its type after its actions have run, whatever
  // they returned, so a chain could never stop it.
  it('makes the entry run its actions and nothing else', () => {
    const entry = cell().asActionCell().build();

    expect(entry.type).toEqual({ value: 'action' });
    expect(entry).not.toHaveProperty('link');
  });
});

describe('EntryBuilder.setLockBadge', () => {
  const entry = (unlocked: boolean, key?: string) =>
    new EntryBuilder(new ActionsBuilder(), { id: 'e1' })
      .setLockBadge(unlocked, key)
      .build();

  it('says locked, says unlocked, and reads from the configured key', () => {
    expect(entry(false).extensions?.unlocked).toBe(false);
    expect(entry(true).extensions?.unlocked).toBe(true);
    expect(entry(true, 'free').extensions?.free).toBe(true);
  });

  it('leaves an entry that says nothing without a badge', () => {
    const plain = new EntryBuilder(new ActionsBuilder(), { id: 'e1' }).build();

    expect(plain.extensions).not.toHaveProperty('unlocked');
  });
});

describe('ActionsBuilder.pinCode', () => {
  it('presents the parent lock screen for a flow, and validates', () => {
    const [action] = new ActionsBuilder()
      .pinCode({
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: 'owner-id', purpose: 'manage' },
      })
      .build();

    expect(action).toEqual({
      type: 'pinCode',
      options: {
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: 'owner-id', purpose: 'manage' },
      },
    });

    expect(validateActionPayload(action.type, action.options)).toBe(true);
  });

  it('refuses a flow the parent lock does not have', () => {
    expect(
      validateActionPayload('pinCode', {
        typeMapping: 'parent-lock',
        flow: 'unlock-everything',
      }),
    ).toBe(false);
  });
});

describe('ActionsBuilder.showAlert', () => {
  // The one dialog with a single button: `confirmDialog` always renders two.
  it('tells the user something, and validates', () => {
    const [action] = new ActionsBuilder()
      .showAlert({ title: 'Locked', message: 'Ask the account owner.' })
      .build();

    expect(action).toEqual({
      type: 'showAlert',
      options: { title: 'Locked', message: 'Ask the account owner.' },
    });

    expect(validateActionPayload(action.type, action.options)).toBe(true);
  });

  it('needs a title', () => {
    expect(validateActionPayload('showAlert', { message: 'no title' })).toBe(
      false,
    );
  });
});

describe('ActionsBuilder.navigateToScreen', () => {
  it('carries an entry, so a chain can end where a plain cell would have', () => {
    const original = { id: 'e1', type: { value: 'audio-detail' } };

    const [action] = new ActionsBuilder()
      .navigateToScreen({
        typeMapping: 'audio-detail',
        navigationAction: 'push',
        entry: original,
      })
      .build();

    expect(action.options).toEqual({
      typeMapping: 'audio-detail',
      navigationAction: 'push',
      entry: original,
    });

    expect(validateActionPayload(action.type, action.options)).toBe(true);
  });

  it('still builds the plain form', () => {
    const [action] = new ActionsBuilder()
      .navigateToScreen({ typeMapping: 'home' })
      .build();

    expect(action.options).toEqual({ typeMapping: 'home' });
    expect(validateActionPayload(action.type, action.options)).toBe(true);
  });
});
