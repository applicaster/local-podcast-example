import { z } from 'zod';

export const PreferenceEditorOptionsSchema = z.object({
  key: z.string(),
  scope: z.enum(['local', 'session', 'screen']),
  select_mode: z.enum(['single', 'multi']),
  max_items: z.number().optional(),
  current_value: z.union([z.string(), z.array(z.string())]).optional(),
  initial_value: z.union([z.string(), z.array(z.string())]).optional(),
});
export type PreferenceEditorOptions = z.infer<typeof PreferenceEditorOptionsSchema>;

export const BehaviorSchema = z.object({
  select_mode: z.enum(['single', 'multi']),
  current_selection: z.union([z.string(), z.array(z.string())]),
});
export type Behavior = z.infer<typeof BehaviorSchema>;

// ==========================================
// Action Schemas & Types
// ==========================================

export const OpenBottomSheetModalPresentationSchema = z.object({
  type: z.string(),
  style_variant: z.string().optional(),
});
export type OpenBottomSheetModalPresentation = z.infer<
  typeof OpenBottomSheetModalPresentationSchema
>;

export const OpenBottomSheetHeaderSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
});
export type OpenBottomSheetHeader = z.infer<typeof OpenBottomSheetHeaderSchema>;

export const OpenBottomSheetContentSchema = z.object({
  title: z.string().optional(),
  itemsUrl: z.string().min(1),
  items: z.array(z.any()).optional(),
});
export type OpenBottomSheetContent = z.infer<
  typeof OpenBottomSheetContentSchema
>;

export const OpenBottomSheetActionOptionsSchema = z.object({
  modal_presentation: OpenBottomSheetModalPresentationSchema.optional(),
  header: OpenBottomSheetHeaderSchema.optional(),
  content: OpenBottomSheetContentSchema,
});
export type OpenBottomSheetActionOptions = z.infer<
  typeof OpenBottomSheetActionOptionsSchema
>;

export const OpenBottomSheetActionSchema = z.object({
  type: z.literal('openBottomSheet'),
  options: OpenBottomSheetActionOptionsSchema,
});
export type OpenBottomSheetAction = z.infer<typeof OpenBottomSheetActionSchema>;

export const SendCloudEventActionOptionsSchema = z.object({
  url: z.string().min(1),
  type: z.string().optional(),
  subject: z.string().optional(),
  data: z.any().optional(),
  inflateData: z.boolean().optional(),
});
export type SendCloudEventActionOptions = z.infer<
  typeof SendCloudEventActionOptionsSchema
>;

export const SendCloudEventActionSchema = z.object({
  type: z.literal('sendCloudEvent'),
  options: SendCloudEventActionOptionsSchema,
});
export type SendCloudEventAction = z.infer<typeof SendCloudEventActionSchema>;

export const ShowTextInputActionOptionsSchema = z.object({
  headerTitle: z.string().optional(),
  inputLabel: z.string().optional(),
  defaultValue: z.string().optional(),
  buttonLabel: z.string().optional(),
  action: z
    .object({
      type: z.string(),
      options: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});
export type ShowTextInputActionOptions = z.infer<
  typeof ShowTextInputActionOptionsSchema
>;

export const ShowTextInputActionSchema = z.object({
  type: z.literal('showTextInput'),
  options: ShowTextInputActionOptionsSchema,
});
export type ShowTextInputAction = z.infer<typeof ShowTextInputActionSchema>;

export const ConfirmDialogActionOptionsSchema = z.object({
  message: z.string(),
  title: z.string().optional(),
  okButtonText: z.string().optional(),
  cancelButtonText: z.string().optional(),
});
export type ConfirmDialogActionOptions = z.infer<
  typeof ConfirmDialogActionOptionsSchema
>;

export const ConfirmDialogActionSchema = z.object({
  type: z.literal('confirmDialog'),
  options: ConfirmDialogActionOptionsSchema,
});
export type ConfirmDialogAction = z.infer<typeof ConfirmDialogActionSchema>;

export const ToggleStorageFlagActionOptionsSchema = z
  .object({
    key: z.string().min(1),
    max_items: z.number().optional(),
    selector: z.string().min(1).optional(),
    tag: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.tag && data.selector) return false;
      return true;
    },
    {
      message: "Only one of 'tag' or 'selector' may be present.",
      path: ['tag', 'selector'],
    },
  );
export type ToggleStorageFlagActionOptions = z.infer<
  typeof ToggleStorageFlagActionOptionsSchema
>;

export const ToggleStorageFlagActionSchema = z.object({
  type: z.enum([
    'localStorageToggleFlag',
    'sessionStorageToggleFlag',
    'screenToggleFlag',
  ]),
  options: ToggleStorageFlagActionOptionsSchema,
});
export type ToggleStorageFlagAction = z.infer<
  typeof ToggleStorageFlagActionSchema
>;

export const LocalStorageSetActionOptionsSchema = z.object({
  content: z.record(z.string(), z.record(z.string(), z.any())),
});
export type LocalStorageSetActionOptions = z.infer<
  typeof LocalStorageSetActionOptionsSchema
>;

export const LocalStorageSetActionSchema = z.object({
  type: z.literal('localStorageSet'),
  options: LocalStorageSetActionOptionsSchema,
});
export type LocalStorageSetAction = z.infer<
  typeof LocalStorageSetActionSchema
>;

export const SessionStorageSetActionOptionsSchema = z.object({
  content: z.record(z.string(), z.record(z.string(), z.any())),
});
export type SessionStorageSetActionOptions = z.infer<
  typeof SessionStorageSetActionOptionsSchema
>;

export const SessionStorageSetActionSchema = z.object({
  type: z.literal('sessionStorageSet'),
  options: SessionStorageSetActionOptionsSchema,
});
export type SessionStorageSetAction = z.infer<
  typeof SessionStorageSetActionSchema
>;

export const ScreenSetVariableActionOptionsSchema = z.object({
  key: z.string(),
  value: z.any(),
});
export type ScreenSetVariableActionOptions = z.infer<
  typeof ScreenSetVariableActionOptionsSchema
>;

export const ScreenSetVariableActionSchema = z.object({
  type: z.literal('screenSetVariable'),
  options: ScreenSetVariableActionOptionsSchema,
});
export type ScreenSetVariableAction = z.infer<
  typeof ScreenSetVariableActionSchema
>;

export const AppRestartActionSchema = z.object({
  type: z.literal('appRestart'),
  options: z.object({}).optional(),
});
export type AppRestartAction = z.infer<typeof AppRestartActionSchema>;

export const SwitchLayoutActionOptionsSchema = z.object({
  layoutId: z.string().min(1),
});
export type SwitchLayoutActionOptions = z.infer<
  typeof SwitchLayoutActionOptionsSchema
>;

export const SwitchLayoutActionSchema = z.object({
  type: z.literal('switchLayout'),
  options: SwitchLayoutActionOptionsSchema,
});
export type SwitchLayoutAction = z.infer<typeof SwitchLayoutActionSchema>;

export const NavigateToScreenActionOptionsSchema = z.object({
  typeMapping: z.string().min(1),
});
export type NavigateToScreenActionOptions = z.infer<
  typeof NavigateToScreenActionOptionsSchema
>;

export const NavigateToScreenActionSchema = z.object({
  type: z.literal('navigateToScreen'),
  options: NavigateToScreenActionOptionsSchema,
});
export type NavigateToScreenAction = z.infer<
  typeof NavigateToScreenActionSchema
>;

export const SetUILanguageActionOptionsSchema = z.object({
  languageCode: z.string().min(1),
  noConfirmation: z.boolean().optional(),
});
export type SetUILanguageActionOptions = z.infer<
  typeof SetUILanguageActionOptionsSchema
>;

export const SetUILanguageActionSchema = z.object({
  type: z.literal('setUILanguage'),
  options: SetUILanguageActionOptionsSchema,
});
export type SetUILanguageAction = z.infer<typeof SetUILanguageActionSchema>;

export const CompleteFTUEActionSchema = z.object({
  type: z.literal('completeFTUE'),
  options: z.object({}).optional(),
});
export type CompleteFTUEAction = z.infer<typeof CompleteFTUEActionSchema>;

export const CompleteHookActionOptionsSchema = z
  .object({
    success: z.boolean().optional(),
    errorMessage: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.success === true) {
        return data.errorMessage === undefined;
      }
      return true;
    },
    {
      message: 'If success is true, errorMessage must not be present.',
      path: ['errorMessage'],
    },
  );
export type CompleteHookActionOptions = z.infer<
  typeof CompleteHookActionOptionsSchema
>;

export const CompleteHookActionSchema = z.object({
  type: z.literal('completeHook'),
  options: CompleteHookActionOptionsSchema.optional(),
});
export type CompleteHookAction = z.infer<typeof CompleteHookActionSchema>;

export const RefreshComponentActionSchema = z.object({
  type: z.literal('refreshComponent'),
  options: z
    .object({
      componentId: z.string().optional(),
    })
    .optional(),
});
export type RefreshComponentAction = z.infer<
  typeof RefreshComponentActionSchema
>;

export const AddProfileActionSchema = z.object({
  type: z.literal('addProfile'),
  options: z
    .object({
      profileId: z.string().optional(),
    })
    .optional(),
});
export type AddProfileAction = z.infer<typeof AddProfileActionSchema>;

export const ZappActionSchema = z.union([
  OpenBottomSheetActionSchema,
  SendCloudEventActionSchema,
  ShowTextInputActionSchema,
  ConfirmDialogActionSchema,
  ToggleStorageFlagActionSchema,
  LocalStorageSetActionSchema,
  SessionStorageSetActionSchema,
  ScreenSetVariableActionSchema,
  AppRestartActionSchema,
  SwitchLayoutActionSchema,
  NavigateToScreenActionSchema,
  SetUILanguageActionSchema,
  CompleteFTUEActionSchema,
  CompleteHookActionSchema,
  RefreshComponentActionSchema,
  AddProfileActionSchema,
]);
export type ZappAction = z.infer<typeof ZappActionSchema>;

export const EntryActionSchema = z.object({
  id: z.string().optional(),
  alias: z.string(),
  actions: z.array(ZappActionSchema),
});
export type EntryAction = z.infer<typeof EntryActionSchema>;

export const TapActionsSchema = z.object({
  actions: z.array(ZappActionSchema),
});
export type TapActions = z.infer<typeof TapActionsSchema>;

// ==========================================
// Entry and Feed Schemas & Types
// ==========================================

export const ZappEntrySchema = z.object({
  id: z.string().optional(),
  type: z.any().optional(),
  extensions: z.record(z.string(), z.any()).optional(),
});

// Allow extensions to be either:
// 1. { role, preference_editor_options } (client will add behavior)
// 2. { preference_editor_options, behavior, role? } (pre-inflated)
const ExtensionsWithRole = z.object({
  role: z.string(),
  preference_editor_options: PreferenceEditorOptionsSchema,
});
const ExtensionsWithBehavior = z.object({
  role: z.string().optional(),
  preference_editor_options: PreferenceEditorOptionsSchema,
  behavior: BehaviorSchema,
});

export const ZappFeedSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  extensions: ExtensionsWithRole.or(ExtensionsWithBehavior),
  entry: z.array(ZappEntrySchema).optional(),
});

export function validatePreferenceEditorOptions(payload: any): boolean {
  return PreferenceEditorOptionsSchema.safeParse(payload).success;
}

export function validateBehavior(payload: any): boolean {
  return BehaviorSchema.safeParse(payload).success;
}

export function validateZappFeed(payload: any): boolean {
  return ZappFeedSchema.safeParse(payload).success;
}

export function validateZappAction(payload: any): boolean {
  return ZappActionSchema.safeParse(payload).success;
}
