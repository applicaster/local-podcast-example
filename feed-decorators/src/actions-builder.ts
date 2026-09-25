import {
  OpenBottomSheetActionOptions,
  ShowToastActionOptions,
} from './zod-definitions';

export type Action = {
  type: string;
  options?: Record<string, any>;
};

export class ActionsBuilder {
  protected actions: Action[] = [];

  constructor() {}

  /**
   * Adds an openBottomSheet action to the actions list.
   * @param opts Options for openBottomSheet (modal_presentation, header, content)
   */
  openBottomSheet(opts: OpenBottomSheetActionOptions) {
    this.actions.push({
      type: 'openBottomSheet',
      options: opts,
    });
    return this;
  }

  /**
   * Pushes a raw action to the builder.
   */
  addAction(action: Action) {
    this.actions.push(action);
    return this;
  }

  /**
   * Adds an appRestart action to the actions list. No options required.
   */
  appRestart() {
    this.actions.push({ type: 'appRestart' });
    return this;
  }

  /**
   * Adds a switchLayout action to the actions list.
   * @param opts Options for switchLayout (layoutId required)
   */
  switchLayout(opts: { layoutId: string }) {
    this.actions.push({
      type: 'switchLayout',
      options: { layoutId: opts.layoutId },
    });
    return this;
  }

  /**
   * Adds a navigateToScreen action to the actions list.
   *
   * With an `entry`, the client opens that entry on the screen the type maps
   * to. That is what lets a cell run a chain of its own and still end up where
   * a plain cell would have gone — a chain the client can stop, unlike the
   * navigation a plain cell performs regardless.
   *
   * @param opts typeMapping required; navigationAction and entry optional
   */
  navigateToScreen(opts: {
    typeMapping: string;
    navigationAction?: 'push' | 'replace';
    entry?: Record<string, any>;
  }) {
    this.actions.push({
      type: 'navigateToScreen',
      options: {
        typeMapping: opts.typeMapping,
        ...(opts.navigationAction
          ? { navigationAction: opts.navigationAction }
          : {}),
        ...(opts.entry ? { entry: opts.entry } : {}),
      },
    });
    return this;
  }

  /**
   * Adds a pinCode action, which presents the parent lock screen and runs one
   * of its flows. The chain stops only if the user backs out: a wrong code
   * resolves as an error and the chain carries on, so whatever follows must
   * still be refused by the server on its own terms.
   *
   * @param opts typeMapping and flow required; cloudEventPayload names the
   * profile whose PIN is being handled, without which the event is about the
   * account-wide PIN
   */
  pinCode(opts: {
    typeMapping: string;
    flow: 'verify-pin' | 'verify' | 'set-pin' | 'change-pin' | 'reset-pin';
    navigationAction?: 'push' | 'replace';
    cloudEventPayload?: Record<string, any>;
    /** What the screen asks for, instead of the app-wide configured string. */
    promptText?: string;
    /** The way out for someone who does not have the code. */
    forgotText?: string;
    forgotActions?: Action[];
  }) {
    this.actions.push({
      type: 'pinCode',
      options: {
        typeMapping: opts.typeMapping,
        flow: opts.flow,
        ...(opts.navigationAction
          ? { navigationAction: opts.navigationAction }
          : {}),
        ...(opts.cloudEventPayload
          ? { cloudEventPayload: opts.cloudEventPayload }
          : {}),
        ...(opts.promptText ? { promptText: opts.promptText } : {}),
        ...(opts.forgotActions?.length
          ? {
              ...(opts.forgotText ? { forgotText: opts.forgotText } : {}),
              forgotActions: opts.forgotActions,
            }
          : {}),
      },
    });
    return this;
  }

  /**
   * Adds a setUILanguage action to the actions list.
   * @param opts Options for setUILanguage (languageCode required, noConfirmation optional)
   */
  setUILanguage(opts: { languageCode: string; noConfirmation?: boolean }) {
    this.actions.push({
      type: 'setUILanguage',
      options: {
        languageCode: opts.languageCode,
        ...(opts.noConfirmation !== undefined
          ? { noConfirmation: opts.noConfirmation }
          : {}),
      },
    });
    return this;
  }

  /**
   * Adds a completeFTUE action to the actions list. No options required.
   */
  completeFTUE() {
    this.actions.push({ type: 'completeFTUE' });
    return this;
  }

  /**
   * Adds a finishHook action to the actions list.
   * @param opts Options for the finishHook (e.g., success: true)
   */
  completeHook(opts: { success?: boolean; errorMessage?: string }) {
    this.actions.push({
      type: 'completeHook',
      options: opts || {},
    });
    return this;
  }

  /**
   * Adds an addToQueue action to the actions list.
   */
  addToQueue() {
    this.actions.push({ type: 'addToQueue', options: {} });
    return this;
  }

  /**
   * Adds an addAllToQueue action to the actions list.
   * @param opts Options containing the collection URL, optional position, and optional startPlayback flag
   */
  addAllToQueue(opts: {
    url: string;
    position?: 'top' | 'bottom';
    startPlayback?: boolean;
  }) {
    this.actions.push({
      type: 'addAllToQueue',
      options: opts,
    });
    return this;
  }

  /**
   * Adds a showToast action to the actions list.
   * @param message The message to display in the toast notification
   * @param options Optional configuration for id, extraMessage, timeout (in ms), and custom style (colors, font, etc.)
   */
  showToast(
    message: string,
    options?: Omit<ShowToastActionOptions, 'message'>,
  ) {
    this.actions.push({
      type: 'showToast',
      options: { message, ...options },
    });
    return this;
  }

  /**
   * Adds a confirmDialog action to the actions list.
   * @param opts Options for the confirm dialog (message, title, okButtonText, cancelButtonText)
   */
  confirmDialog(opts: {
    message: string;
    title?: string;
    okButtonText?: string;
    cancelButtonText?: string;
  }) {
    this.actions.push({
      type: 'confirmDialog',
      options: {
        message: opts.message,
        title: opts.title,
        okButtonText: opts.okButtonText,
        cancelButtonText: opts.cancelButtonText,
      },
    });
    return this;
  }

  /**
   * Adds a showAlert action: one button, because there is nothing to decide.
   *
   * Use it wherever the user is only being told something — `confirmDialog`
   * always renders two buttons, and without a cancel label the second one
   * comes out blank. Dismissing a notice is not a cancellation, so the action
   * resolves as a success and the rest of the chain runs.
   *
   * @param opts title required; message and okButtonText optional
   */
  showAlert(opts: { title: string; message?: string; okButtonText?: string }) {
    this.actions.push({
      type: 'showAlert',
      options: {
        title: opts.title,
        ...(opts.message ? { message: opts.message } : {}),
        ...(opts.okButtonText ? { okButtonText: opts.okButtonText } : {}),
      },
    });
    return this;
  }

  /**
   * Adds a showTextInput action to the actions list.
   * @param opts Options for showTextInput (headerTitle, inputLabel, defaultValue, buttonLabel, actions)
   */
  showTextInput(opts: {
    headerTitle?: string;
    inputLabel?: string;
    defaultValue?: string;
    buttonLabel?: string;
    actions: Action[];
  }) {
    this.actions.push({
      type: 'showTextInput',
      options: opts,
    });
    return this;
  }

  /**
   * Adds a refreshComponent action to the actions list.
   * No options are required for this action.
   */
  refreshComponent() {
    this.actions.push({
      type: 'refreshComponent',
    });
    return this;
  }

  /**
   * Adds a toggleStorageFlag action (local/session/screen) to the actions list.
   * @param opts Options for toggleStorageFlag (scope: 'local' | 'session' | 'screen', key required, selector/tag/maxItems optional)
   */
  toggleStorageFlag(opts: {
    key: string;
    scope?: string;
    maxItems?: number;
    selector?: string;
    tag?: string;
  }) {
    if (!opts.key) throw new Error("toggleStorageFlag: 'key' is required");
    const scope = opts.scope || 'local';
    const actionType =
      scope === 'screen'
        ? 'screenToggleFlag'
        : scope === 'session'
          ? 'sessionStorageToggleFlag'
          : 'localStorageToggleFlag';
    const actionOptions: {
      key: string;
      max_items?: number;
      selector?: string;
      tag?: string;
    } = { key: opts.key };
    if (typeof opts.maxItems === 'number') {
      actionOptions.max_items = opts.maxItems;
    }
    if (typeof opts.selector === 'string') {
      actionOptions.selector = opts.selector;
    }
    if (typeof opts.tag === 'string') {
      actionOptions.tag = opts.tag;
    }
    this.actions.push({ type: actionType, options: actionOptions });
    return this;
  }

  /**
   * Adds a localStorageSet action to the actions list.
   * @param opts Object with content mapping namespaces to key-value pairs.
   */
  setLocalStorage(opts: { content: Record<string, Record<string, any>> }) {
    this.actions.push({
      type: 'localStorageSet',
      options: { content: opts.content },
    });
    return this;
  }

  /**
   * Adds a sessionStorageSet action to the actions list.
   * @param opts Object with content mapping namespaces to key-value pairs.
   */
  setSessionStorage(opts: { content: Record<string, Record<string, any>> }) {
    this.actions.push({
      type: 'sessionStorageSet',
      options: { content: opts.content },
    });
    return this;
  }

  /**
   * Adds a screenSetVariable action to the actions list.
   * @param opts Object with key and value for the screen variable.
   */
  setScreenVariable(opts: { key: string; value: any }) {
    this.actions.push({
      type: 'screenSetVariable',
      options: { key: opts.key, value: opts.value },
    });
    return this;
  }

  /**
   * Adds a sendCloudEvent action to the actions list.
   * @param opts Options for sendCloudEvent (url required, type/subject/data/inflateData optional)
   */
  sendCloudEvent(opts: {
    url: string;
    type?: string;
    subject?: string;
    data?: any;
    inflateData?: boolean;
  }) {
    if (!opts.url) throw new Error("sendCloudEvent: 'url' is required");

    const cloudEventOptions: Record<string, any> = { url: opts.url };
    if (opts.type) cloudEventOptions.type = opts.type;
    if (opts.subject) cloudEventOptions.subject = opts.subject;
    if (opts.data) cloudEventOptions.data = opts.data;
    if (typeof opts.inflateData === 'boolean') {
      cloudEventOptions.inflateData = opts.inflateData;
    }
    this.actions.push({ type: 'sendCloudEvent', options: cloudEventOptions });
    return this;
  }

  /**
   * Adds a setVariable action (deprecated, use setLocalStorage/setSessionStorage/setScreenVariable instead).
   * @param opts Options for setVariable (scope, key, value, namespace)
   */
  setVariable(opts: {
    key: string;
    value: any;
    scope?: string;
    namespace?: string;
  }) {
    if (!opts.key) throw new Error("setVariable: 'key' is required");
    const scope = opts.scope || 'screen';
    if (scope === 'screen') {
      if (opts.namespace)
        throw new Error(
          "setVariable: 'namespace' should not be provided for screen scope",
        );
      return this.setScreenVariable({ key: opts.key, value: opts.value });
    } else if (scope === 'session') {
      if (!opts.namespace)
        throw new Error(
          "setVariable: 'namespace' is required for session storage",
        );
      return this.setSessionStorage({
        content: { [opts.namespace]: { [opts.key]: opts.value } },
      });
    } else {
      if (!opts.namespace)
        throw new Error(
          "setVariable: 'namespace' is required for local storage",
        );
      return this.setLocalStorage({
        content: { [opts.namespace]: { [opts.key]: opts.value } },
      });
    }
  }

  /**
   * Alias for build(). Returns the accumulated actions array.
   * @returns An array of Action objects.
   */
  buildActions(): Action[] {
    return this.actions;
  }

  /**
   * Returns the accumulated actions array.
   * @returns An array of Action objects.
   */
  build(): Action[] {
    return this.actions;
  }
}
