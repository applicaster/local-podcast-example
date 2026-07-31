/**
 * Action Types - Based on Zapp / Applicaster Actions DSL
 * Full specification: feed-decorators/docs/Actions.md
 */

export interface ModalPresentation {
  type: 'bottom_sheet' | string;
  style_variant?: string;
}

export interface OpenBottomSheetHeader {
  title?: string;
  subtitle?: string;
}

export interface OpenBottomSheetContent {
  title?: string;
  itemsUrl: string;
  items?: any[];
}

export interface OpenBottomSheetOptions {
  modal_presentation?: ModalPresentation;
  header?: OpenBottomSheetHeader;
  content: OpenBottomSheetContent;
}

export interface OpenBottomSheetAction {
  type: 'openBottomSheet';
  options: OpenBottomSheetOptions;
}

export interface SendCloudEventOptions {
  url: string;
  type?: string;
  subject?: string;
  data?: any;
  inflateData?: boolean;
}

export interface SendCloudEventAction {
  type: 'sendCloudEvent';
  options: SendCloudEventOptions;
}

export interface ShowTextInputOptions {
  headerTitle?: string;
  inputLabel?: string;
  defaultValue?: string;
  buttonLabel?: string;
  actions: Action[];
}

export interface ShowTextInputAction {
  type: 'showTextInput';
  options: ShowTextInputOptions;
}

export interface ConfirmDialogOptions {
  message: string;
  title?: string;
  okButtonText?: string;
  cancelButtonText?: string;
}

export interface ConfirmDialogAction {
  type: 'confirmDialog';
  options: ConfirmDialogOptions;
}

export interface ToggleStorageFlagOptions {
  key: string;
  max_items?: number;
  selector?: string;
  tag?: string;
}

export interface ToggleStorageFlagAction {
  type:
    | 'localStorageToggleFlag'
    | 'sessionStorageToggleFlag'
    | 'screenToggleFlag';
  options: ToggleStorageFlagOptions;
}

export interface LocalStorageSetOptions {
  content: Record<string, Record<string, any>>;
}

export interface LocalStorageSetAction {
  type: 'localStorageSet';
  options: LocalStorageSetOptions;
}

export interface SessionStorageSetOptions {
  content: Record<string, Record<string, any>>;
}

export interface SessionStorageSetAction {
  type: 'sessionStorageSet';
  options: SessionStorageSetOptions;
}

export interface ScreenSetVariableOptions {
  key: string;
  value: any;
}

export interface ScreenSetVariableAction {
  type: 'screenSetVariable';
  options: ScreenSetVariableOptions;
}

export interface AppRestartAction {
  type: 'appRestart';
  options?: Record<string, never>;
}

export interface SwitchLayoutOptions {
  layoutId: string;
}

export interface SwitchLayoutAction {
  type: 'switchLayout';
  options: SwitchLayoutOptions;
}

export interface NavigateToScreenOptions {
  typeMapping: string;
}

export interface NavigateToScreenAction {
  type: 'navigateToScreen';
  options: NavigateToScreenOptions;
}

export interface SetUILanguageOptions {
  languageCode: string;
  noConfirmation?: boolean;
}

export interface SetUILanguageAction {
  type: 'setUILanguage';
  options: SetUILanguageOptions;
}

export interface CompleteFTUEAction {
  type: 'completeFTUE';
  options?: Record<string, never>;
}

export interface CompleteHookOptions {
  success?: boolean;
  errorMessage?: string;
}

export interface CompleteHookAction {
  type: 'completeHook';
  options?: CompleteHookOptions;
}

export interface RefreshComponentOptions {
  componentId?: string;
}

export interface RefreshComponentAction {
  type: 'refreshComponent';
  options?: RefreshComponentOptions;
}

export interface AddToQueueAction {
  type: 'addToQueue';
  options?: Record<string, never>;
}

export interface AddAllToQueueOptions {
  url: string;
}

export interface AddAllToQueueAction {
  type: 'addAllToQueue';
  options: AddAllToQueueOptions;
}

export type Action =
  | OpenBottomSheetAction
  | SendCloudEventAction
  | ShowTextInputAction
  | ConfirmDialogAction
  | ToggleStorageFlagAction
  | LocalStorageSetAction
  | SessionStorageSetAction
  | ScreenSetVariableAction
  | AppRestartAction
  | SwitchLayoutAction
  | NavigateToScreenAction
  | SetUILanguageAction
  | CompleteFTUEAction
  | CompleteHookAction
  | RefreshComponentAction
  | AddToQueueAction
  | AddAllToQueueAction
  | {
      type: string;
      options?: Record<string, any>;
    };

export interface EntryAction {
  id?: string;
  alias?: string;
  button?: {
    alias: string;
    [key: string]: any;
  };
  dismiss_on_action?: boolean;
  actions: Action[];
}

export interface TapActions {
  actions: Action[];
}
