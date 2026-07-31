import { ActionsBuilder, validateActionPayload } from '../index';

describe('toggleStorageFlag action with selector', () => {
  it('should support selector option and validate with Zod', () => {
    const builder = new ActionsBuilder();
    builder.toggleStorageFlag({
      key: 'genres',
      selector: 'extensions.genre_tag',
      maxItems: 3,
    });
    const actions = builder.build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action && action.options) {
      expect(action.type).toMatch(/ToggleFlag/);
      expect(action.options.key).toBe('genres');
      expect(action.options.selector).toBe('extensions.genre_tag');
      expect(action.options.max_items).toBe(3);
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });
});

describe('ActionsBuilder + Zod validation', () => {
  it('should build and validate appRestart action', () => {
    const actions = new ActionsBuilder().appRestart().build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('appRestart');
      // options are optional for appRestart
      expect(validateActionPayload(action.type, action.options)).toBe(true);
      expect(validateActionPayload(action.type, undefined)).toBe(true);
    }
  });

  it('should build and validate switchLayout action', () => {
    const actions = new ActionsBuilder()
      .switchLayout({ layoutId: 'layout-123' })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('switchLayout');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate navigateToScreen action', () => {
    const actions = new ActionsBuilder()
      .navigateToScreen({ typeMapping: 'devices' })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('navigateToScreen');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate setUILanguage action', () => {
    const actions = new ActionsBuilder()
      .setUILanguage({ languageCode: 'en-UK', noConfirmation: true })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('setUILanguage');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate completeFTUE action', () => {
    const actions = new ActionsBuilder().completeFTUE().build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeFTUE');
      // options are optional for completeFTUE
      expect(validateActionPayload(action.type, action.options)).toBe(true);
      expect(validateActionPayload(action.type, undefined)).toBe(true);
    }
  });

  it('should build and validate completeHook action (success)', () => {
    const actions = new ActionsBuilder()
      .completeHook({ success: true })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeHook');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate completeHook action (errorMessage)', () => {
    const actions = new ActionsBuilder()
      .completeHook({ errorMessage: 'You shall not pass!' })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeHook');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should fail validation for completeHook with both success:true and errorMessage', () => {
    const actions = new ActionsBuilder()
      .completeHook({ success: true, errorMessage: 'Should not be here' })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeHook');
      expect(validateActionPayload(action.type, action.options)).toBe(false);
    }
  });

  it('should build and validate openBottomSheet action', () => {
    const actions = new ActionsBuilder()
      .openBottomSheet({
        modal_presentation: {
          type: 'bottom_sheet',
          style_variant: 'modal_bottom_sheet',
        },
        header: {
          title: 'Select Playlist',
          subtitle: 'Add item to playlist',
        },
        content: {
          title: 'Your Collections',
          itemsUrl: 'http://localhost:3000/user/collections?item_id=123',
          items: [],
        },
      })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('openBottomSheet');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate showTextInput action', () => {
    const actions = new ActionsBuilder()
      .showTextInput({
        headerTitle: 'Edit Playlist',
        inputLabel: 'Name',
        defaultValue: 'My Playlist',
        buttonLabel: 'Save',
        actions: [
          {
            type: 'sendCloudEvent',
            options: {
              url: 'https://example.com/events',
            },
          },
        ],
      })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('showTextInput');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate confirmDialog action', () => {
    const actions = new ActionsBuilder()
      .confirmDialog({
        title: 'Delete',
        message: 'Are you sure?',
        okButtonText: 'Yes',
        cancelButtonText: 'No',
      })
      .build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('confirmDialog');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate refreshComponent action', () => {
    const actions = new ActionsBuilder().refreshComponent().build();
    const action = actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('refreshComponent');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });
});

