import { isMaster, ProfilesRepository } from './profiles.repository';

describe('isMaster', () => {
  // The flag arrived as a boolean from CRM/v3/viewer-profiles and as 1/0 from
  // CMS/profiles/select, so both count.
  it.each([[true], [1], ['1']])('treats %p as the account owner', (value) => {
    expect(isMaster(value)).toBe(true);
  });

  // "0" is truthy in JS: a naive Boolean() would make every profile an owner
  // the day the backend starts sending strings.
  it.each([[false], [0], ['0'], [undefined], [null], ['yes'], ['']])(
    'treats %p as an ordinary profile',
    (value) => {
      expect(isMaster(value)).toBe(false);
    },
  );
});

describe('ProfilesRepository', () => {
  const feed = {
    id: 'viewer-profiles',
    title: 'Viewer Profiles',
    type: { value: 'feed' },
    entry: [
      { id: 'owner', extensions: { master: 1, kids: false } },
      { id: 'kid', extensions: { master: 0, kids: true } },
      { id: 'adult', extensions: { master: 0, kids: false } },
    ],
  };

  const build = async (loaded: unknown = feed): Promise<ProfilesRepository> => {
    const repository = new ProfilesRepository();
    jest.spyOn(repository as any, 'loadFeed').mockResolvedValue(loaded);
    await repository.onModuleInit();

    return repository;
  };

  it('lists the profiles it loaded', async () => {
    const repository = await build();

    expect(repository.profileIds()).toEqual(['owner', 'kid', 'adult']);
  });

  it('finds the profile carrying master', async () => {
    const repository = await build();

    expect(repository.ownerId()).toBe('owner');
  });

  // Nobody holding parental authority is a valid state, and every caller
  // reads the empty string as "no owner" rather than as a profile id.
  it('answers with an empty string when no profile is master', async () => {
    const repository = await build({
      ...feed,
      entry: [{ id: 'adult', extensions: { master: 0 } }],
    });

    expect(repository.ownerId()).toBe('');
  });

  it('takes the first of several masters rather than failing', async () => {
    const repository = await build({
      ...feed,
      entry: [
        { id: 'first', extensions: { master: 1 } },
        { id: 'second', extensions: { master: 1 } },
      ],
    });

    expect(repository.ownerId()).toBe('first');
  });

  it('serves an empty feed when the fixture is unusable', async () => {
    const repository = await build({ id: 'x', entry: 'not-an-array' });

    expect(repository.profileIds()).toEqual([]);
    expect(repository.ownerId()).toBe('');
  });
});
