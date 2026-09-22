import {
  DEFAULT_PROFILES_FORM_URL,
  ProfilesFormService,
} from './profiles.form.service';

describe('ProfilesFormService', () => {
  const flatProperties = () => [
    { id: 'profileImage', type: 'singleSelect', preset: 'FormAvatarPicker' },
    { id: 'displayName', type: 'textInput', preset: 'FormTextInput' },
    { id: 'buttonSave', type: 'button', preset: 'FormButtonSave' },
    { id: 'buttonCancel', type: 'button', preset: 'FormButtonCancel' },
  ];

  const upstreamForm = () => ({
    body: {
      properties: [
        {
          id: 'profileImage',
          type: 'singleSelect',
          preset: 'FormAvatarPicker',
        },
        { id: 'displayName', type: 'textInput', preset: 'FormTextInput' },
        { id: 'buttonSave', type: 'button', preset: 'FormButtonSave' },
        { id: 'buttonCancel', type: 'button', preset: 'FormButtonCancel' },
      ],
    },
  });

  const build = ({
    form = upstreamForm() as any,
    owner = 'owner',
    pins = ['owner'],
    configured = undefined as string | undefined,
  } = {}) => {
    const get = jest.fn(async () => form);
    const service = new ProfilesFormService(
      { get } as any,
      {
        get: jest.fn((key: string) =>
          key === '@lib/mock-podcast.config.profilesFormUrl'
            ? configured
            : undefined,
        ),
      } as any,
      { hasPin: jest.fn((p: string) => pins.includes(p)) } as any,
      {
        ownerId: () => owner,
        nameOf: () => '',
        entryOf: (id: string) => ({
          id,
          extensions: { denied_actions: { change_name: true } },
        }),
      } as any,
    );

    return { service, get };
  };

  const req = (headers: Record<string, string>) => ({ headers }) as any;

  const propertiesOf = (form: any) => form.body?.properties ?? form.properties;
  const pinButton = (form: any) =>
    propertiesOf(form).find((p: any) => p.id === 'buttonManagePin');

  // The viewer is the parent while a child is edited, so a form that names
  // nobody gets no button rather than one pointed at whoever is looking.
  it('serves the form unpatched when no profile is named', async () => {
    const { service } = build();

    const form = await service.getForm('', req({}));

    expect(pinButton(form)).toBeUndefined();
  });

  it('asks the real backend by default', async () => {
    const { service, get } = build();

    await service.getForm('kid', req({}));

    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('Profile form'),
      DEFAULT_PROFILES_FORM_URL,
      expect.anything(),
    );
  });

  it('uses the configured upstream when there is one', async () => {
    const { service, get } = build({ configured: 'https://other/form' });

    await service.getForm('kid', req({}));

    expect(get).toHaveBeenCalledWith(
      expect.anything(),
      'https://other/form',
      expect.anything(),
    );
  });

  it('keeps the form the upstream sent', async () => {
    const { service } = build();

    const form = await service.getForm('kid', req({}));

    expect(propertiesOf(form).map((p: any) => p.id)).toEqual([
      'profileImage',
      'displayName',
      'parentalControlsHeading',
      'allowComment',
      'allowChangePicture',
      'allowChangeName',
      'allowOfflineDownload',
      'allowFavorites',
      'buttonManagePin',
      'buttonSave',
      'buttonCancel',
    ]);
  });

  // Save and Cancel belong together at the bottom, so the new control goes in
  // front of the first button rather than at the end.
  it('puts the button before the form own buttons', async () => {
    const { service } = build();

    const form = await service.getForm('kid', req({}));

    const ids = propertiesOf(form).map((p: any) => p.id);
    expect(ids.indexOf('buttonManagePin')).toBeLessThan(
      ids.indexOf('buttonSave'),
    );
  });

  it('names the target profile in the reset event', async () => {
    const { service } = build();

    const form = await service.getForm('kid', req({}));
    const actions = pinButton(form).options.extensions.tap_actions.actions;

    expect(actions.map((a: any) => a.type)).toEqual(['pinCode', 'pinCode']);
    expect(actions[0].options.cloudEventPayload).toEqual({
      profile: 'owner',
      purpose: 'manage',
    });

    // The owner types the code; the plugin sends it named for the target.
    expect(actions[1].options).toEqual({
      typeMapping: 'parent-lock',
      flow: 'set-pin',
      cloudEventPayload: { profile: 'kid' },
      promptText: 'Set a new PIN',
    });
  });

  // A form shows nothing that depends on a PIN, so there is nothing to
  // re-read once one changes.
  it('does not refresh the form after the PIN changes', async () => {
    const { service } = build();

    const form = await service.getForm('kid', req({}));
    const actions = pinButton(form).options.extensions.tap_actions.actions;

    expect(actions.map((a: any) => a.type)).not.toContain('refreshComponent');
  });

  it('renames itself when the profile has no pin yet', async () => {
    const { service } = build({ pins: ['owner'] });

    const form = await service.getForm('kid', req({}));

    expect(pinButton(form).options.title).toBe('Set PIN');
  });

  it('says Change when the profile already has one', async () => {
    const { service } = build({ pins: ['owner', 'kid'] });

    const form = await service.getForm('kid', req({}));

    expect(pinButton(form).options.title).toBe('Change PIN');
  });

  it('drops the verify step when the owner has no pin of their own', async () => {
    const { service } = build({ pins: [] });

    const form = await service.getForm('kid', req({}));
    const actions = pinButton(form).options.extensions.tap_actions.actions;

    expect(actions.map((a: any) => a.type)).toEqual(['pinCode']);
    expect(actions[0].options.flow).toBe('set-pin');
  });

  it('adds no button when nobody could authorise the reset', async () => {
    const { service } = build({ owner: '' });

    const form = await service.getForm('kid', req({}));

    expect(pinButton(form)).toBeUndefined();
    expect(propertiesOf(form)).toHaveLength(4);
  });

  // The upstream answers with a bare `properties` array as well as the
  // wrapped shape, and the patch must not change which one comes back.
  it('patches a form whose properties are at the top level', async () => {
    const { service } = build({
      form: { properties: flatProperties() } as any,
    });

    const form: any = await service.getForm('kid', req({}));

    expect(form.body).toBeUndefined();
    expect(form.properties.map((p: any) => p.id)).toEqual([
      'profileImage',
      'displayName',
      'parentalControlsHeading',
      'allowComment',
      'allowChangePicture',
      'allowChangeName',
      'allowOfflineDownload',
      'allowFavorites',
      'buttonManagePin',
      'buttonSave',
      'buttonCancel',
    ]);
  });

  // The section is ours: the customer's form carries an avatar picker and a
  // display name and nothing about permissions.
  it('adds the parental controls the customer form has not got', async () => {
    const { service } = build();

    const form = await service.getForm('kid', req({}));
    const ids = propertiesOf(form).map((p: any) => p.id);

    expect(ids).toContain('parentalControlsHeading');
    expect(ids).toContain('allowComment');

    // What each box is set to arrives with the profile entry, not here: the
    // form declares the field and the entry fills it.
    const denied = propertiesOf(form).find(
      (p: any) => p.id === 'allowChangeName',
    );
    expect(denied.options).not.toHaveProperty('value');
  });

  // An owner restricting themselves protects nobody, so the requirement asks
  // for a nudge towards making a profile per child instead.
  it('gives the owner a note instead of controls on their own profile', async () => {
    const { service } = build();

    const form = await service.getForm('owner', req({}));
    const ids = propertiesOf(form).map((p: any) => p.id);

    expect(ids).toContain('parentalControlsOwnerNote');
    expect(ids).not.toContain('allowComment');
  });

  it('keeps the wrapper when the upstream used one', async () => {
    const { service } = build();

    const form: any = await service.getForm('kid', req({}));

    expect(form.properties).toBeUndefined();
    expect(form.body.properties).toHaveLength(11);
  });

  // Losing the button is a smaller failure than corrupting a form we did not
  // recognise.
  it('passes an unfamiliar shape through untouched', async () => {
    const odd = { something: 'else' };
    const { service } = build({ form: odd as any });

    const form = await service.getForm('kid', req({}));

    expect(form).toEqual(odd);
  });
});
