import { UnauthorizedException } from '@nestjs/common';
import {
  CHILD_LABEL,
  OWNER_LABEL,
  ProfilesManageController,
} from './profiles.manage.controller';

const OWNER = 'owner-id';

describe('ProfilesManageController', () => {
  const req = (profile?: string) =>
    ({
      headers: { authorization: 'Bearer tok', ...(profile ? { profile } : {}) },
    }) as any;

  const build = (hasPin = false, owner = OWNER) =>
    new ProfilesManageController(
      { hasPin: () => hasPin } as any,
      { ownerId: () => owner } as any,
    );

  const entryFor = (hasPin: boolean, viewer?: string) =>
    build(hasPin).getManageEntry(req(viewer)).entry[0] as any;

  const types = (entry: any) =>
    entry.extensions.tap_actions.actions.map((a: any) => a.type);

  it('refuses a request without a token', () => {
    expect(() => build().getManageEntry({ headers: {} } as any)).toThrow(
      UnauthorizedException,
    );
  });

  // One manages everybody, the other manages only itself, and the button is
  // the only place that difference is visible (BR-3).
  it('says Profiles to the owner and Profile to a child', () => {
    expect(entryFor(false, OWNER).title).toBe(OWNER_LABEL);
    expect(entryFor(false, 'kid').title).toBe(CHILD_LABEL);
  });

  it('asks for the code of whoever is holding the phone', () => {
    const entry = entryFor(true, 'kid');

    expect(types(entry)).toEqual(['pinCode', 'navigateToScreen']);

    expect(entry.extensions.tap_actions.actions[0].options).toEqual(
      expect.objectContaining({
        flow: 'verify-pin',
        cloudEventPayload: { profile: 'kid', purpose: 'manage' },
      }),
    );
  });

  // The marker is what separates proving authority from unlocking a profile
  // to watch as; without it, signing in would buy parental rights.
  it('marks the verification as a claim of authority', () => {
    const [gate] = entryFor(true, OWNER).extensions.tap_actions.actions;

    expect(gate.options.cloudEventPayload.purpose).toBe('manage');
  });

  // A gate nobody can pass is a door with no key, not security.
  it('sends a profile with no PIN straight through', () => {
    expect(types(entryFor(false, 'kid'))).toEqual(['navigateToScreen']);
  });

  it('opens the screen the manage mapping points at', () => {
    const actions = entryFor(false, OWNER).extensions.tap_actions.actions;

    expect(actions[0].options).toEqual(
      expect.objectContaining({ typeMapping: 'profiles-manage' }),
    );
  });
});
