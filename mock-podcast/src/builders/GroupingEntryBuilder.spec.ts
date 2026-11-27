import { GroupingEntryBuilder } from './GroupingEntryBuilder';

describe('GroupingEntryBuilder', () => {
  const OWNER = 'owner-id';

  const episode = (extra: any = {}) => ({
    id: 'g2227e852',
    title: 'A Member of the Family, Part 1 of 2',
    type: { value: 'audio-detail' },
    link: { href: 'https://cms/audio-video/852', rel: 'self' },
    extensions: { sensitive_content: 'Mature', ...extra },
  });

  const copy = {
    title: 'Locked',
    message: 'Ask the account owner to set up a PIN.',
    okButtonText: 'OK',
  };

  const actionsOf = (entry: any) => entry.extensions.tap_actions.actions;

  describe('gateBehindPin', () => {
    it('asks for the owner PIN and then opens the original entry', () => {
      const entry = new GroupingEntryBuilder(episode())
        .gateBehindPin(OWNER)
        .build();

      expect(entry.type).toEqual({ value: 'action' });
      expect(entry).not.toHaveProperty('link');
      expect(entry.extensions.unlocked).toBe(false);
      expect(actionsOf(entry)).toEqual([
        {
          type: 'pinCode',
          options: {
            typeMapping: 'parent-lock',
            flow: 'verify-pin',
            cloudEventPayload: { profile: OWNER },
          },
        },
        {
          type: 'navigateToScreen',
          options: {
            typeMapping: 'audio-detail',
            navigationAction: 'push',
            entry: episode(),
          },
        },
      ]);
    });

    it('keeps the actions the entry already had, behind the gate', () => {
      const own = { type: 'showToast', options: { message: 'hi' } };

      const entry = new GroupingEntryBuilder(
        episode({ tap_actions: { actions: [own] } }),
      )
        .gateBehindPin(OWNER)
        .build();

      expect(actionsOf(entry).map((a: any) => a.type)).toEqual([
        'pinCode',
        'showToast',
        'navigateToScreen',
      ]);
    });

    // The "…" menu acts from the cell without running the chain, so leaving it
    // there is a way round the PIN: queue it, download it, never asked.
    it('takes the "…" menu off the cell and leaves it on the copy the screen gets', () => {
      const entry = new GroupingEntryBuilder(
        episode({ entry_action: [{ button: { alias: 'add_to_queue' } }] }),
      )
        .gateBehindPin(OWNER)
        .build();

      expect(entry.extensions).not.toHaveProperty('entry_action');

      const opened = actionsOf(entry).find(
        (a: any) => a.type === 'navigateToScreen',
      );

      expect(opened.options.entry.extensions.entry_action).toEqual([
        { button: { alias: 'add_to_queue' } },
      ]);
    });

    // An action cell navigates on its own, so it only gains the PIN step.
    it('only prepends the PIN to an entry that is already an action', () => {
      const entry = new GroupingEntryBuilder({
        ...episode(),
        type: { value: 'action' },
      })
        .gateBehindPin(OWNER)
        .build();

      expect(entry.link).toBeDefined();
      expect(actionsOf(entry).map((a: any) => a.type)).toEqual(['pinCode']);
    });
  });

  describe('lockWithExplanation', () => {
    it('leaves nothing that could still act on the entry', () => {
      const entry = new GroupingEntryBuilder(
        episode({
          tap_actions: { actions: [{ type: 'showToast' }] },
          entry_action: [{ button: { alias: 'add_to_queue' } }],
        }),
      )
        .lockWithExplanation(copy)
        .build();

      expect(entry.type).toEqual({ value: 'action' });
      expect(entry).not.toHaveProperty('link');
      expect(entry.extensions).not.toHaveProperty('entry_action');
      expect(entry.extensions.locked).toBe(true);
      expect(entry.extensions.unlocked).toBe(false);
      expect(actionsOf(entry)).toEqual([
        {
          type: 'showAlert',
          options: copy,
        },
      ]);
    });
  });

  it('marks an open entry for a configured unlock badge', () => {
    const entry = new GroupingEntryBuilder(episode()).markOpen().build();

    expect(entry.extensions.unlocked).toBe(true);
    expect(entry.link).toBeDefined();
  });

  // The customer's payload travels through this builder; it must come out the
  // other side untouched.
  it('does not write into the entry it was given', () => {
    const upstream = episode({ entry_action: [{ button: {} }] });

    new GroupingEntryBuilder(upstream).lockWithExplanation(copy).build();
    new GroupingEntryBuilder(upstream).gateBehindPin(OWNER).build();

    expect(upstream).toEqual(episode({ entry_action: [{ button: {} }] }));
  });
});
