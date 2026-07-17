import { ActionsBuilder, validateActionPayload } from '../index';

describe('toggleStorageFlag action with selector', () => {
  it('should support selector option and validate with Zod', () => {
    const entry = { id: 'horror', extensions: { genre_tag: 'horror' } };
    const builder = new ActionsBuilder(entry);
    builder.toggleStorageFlag({
      key: 'genres',
      selector: 'extensions.genre_tag',
      maxItems: 3,
    });
    const built = builder.build();
    const action = built.extensions.tap_actions.actions[0];
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
    const entry = new ActionsBuilder({ id: 'test' }).appRestart().build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('appRestart');
      // options are optional for appRestart
      expect(validateActionPayload(action.type, action.options)).toBe(true);
      expect(validateActionPayload(action.type, undefined)).toBe(true);
    }
  });

  it('should build and validate switchLayout action', () => {
    const entry = new ActionsBuilder({ id: 'test' })
      .switchLayout({ layoutId: 'layout-123' })
      .build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('switchLayout');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate navigateToScreen action', () => {
    const entry = new ActionsBuilder({ id: 'test' })
      .navigateToScreen({ typeMapping: 'devices' })
      .build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('navigateToScreen');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate setUILanguage action', () => {
    const entry = new ActionsBuilder({ id: 'test' })
      .setUILanguage({ languageCode: 'en-UK', noConfirmation: true })
      .build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('setUILanguage');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate completeFTUE action', () => {
    const entry = new ActionsBuilder({ id: 'test' }).completeFTUE().build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeFTUE');
      // options are optional for completeFTUE
      expect(validateActionPayload(action.type, action.options)).toBe(true);
      expect(validateActionPayload(action.type, undefined)).toBe(true);
    }
  });

  it('should build and validate completeHook action (success)', () => {
    const entry = new ActionsBuilder({ id: 'test' })
      .completeHook({ success: true })
      .build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeHook');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should build and validate completeHook action (errorMessage)', () => {
    const entry = new ActionsBuilder({ id: 'test' })
      .completeHook({ errorMessage: 'You shall not pass!' })
      .build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeHook');
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    }
  });

  it('should fail validation for completeHook with both success:true and errorMessage', () => {
    const entry = new ActionsBuilder({ id: 'test' })
      .completeHook({ success: true, errorMessage: 'Should not be here' })
      .build();
    const action = entry.extensions.tap_actions.actions[0];
    expect(action).toBeDefined();
    if (action) {
      expect(action.type).toBe('completeHook');
      expect(validateActionPayload(action.type, action.options)).toBe(false);
    }
  });
});
