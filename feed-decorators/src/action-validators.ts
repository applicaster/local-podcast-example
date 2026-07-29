import { z } from 'zod';
import {
  OpenBottomSheetActionOptionsSchema,
  ShowTextInputActionOptionsSchema,
  ConfirmDialogActionOptionsSchema,
  SendCloudEventActionOptionsSchema,
  ToggleStorageFlagActionOptionsSchema,
  LocalStorageSetActionOptionsSchema,
  SessionStorageSetActionOptionsSchema,
  ScreenSetVariableActionOptionsSchema,
  SwitchLayoutActionOptionsSchema,
  NavigateToScreenActionOptionsSchema,
  SetUILanguageActionOptionsSchema,
  CompleteHookActionOptionsSchema,
} from './zod-definitions';

const EmptyOptionalSchema = z.object({}).optional();
const RefreshComponentOptionsSchema = z
  .object({ componentId: z.string().optional() })
  .optional();
const AddProfileOptionsSchema = z
  .object({ profileId: z.string().optional() })
  .optional();
const CompleteHookOptionsSchema = CompleteHookActionOptionsSchema.optional();

export const actionSchemas: Record<string, z.ZodTypeAny> = {
  openBottomSheet: OpenBottomSheetActionOptionsSchema,
  showTextInput: ShowTextInputActionOptionsSchema,
  confirmDialog: ConfirmDialogActionOptionsSchema,
  localStorageToggleFlag: ToggleStorageFlagActionOptionsSchema,
  sessionStorageToggleFlag: ToggleStorageFlagActionOptionsSchema,
  screenToggleFlag: ToggleStorageFlagActionOptionsSchema,
  localStorageSet: LocalStorageSetActionOptionsSchema,
  sessionStorageSet: SessionStorageSetActionOptionsSchema,
  screenSetVariable: ScreenSetVariableActionOptionsSchema,
  sendCloudEvent: SendCloudEventActionOptionsSchema,
  appRestart: EmptyOptionalSchema,
  switchLayout: SwitchLayoutActionOptionsSchema,
  navigateToScreen: NavigateToScreenActionOptionsSchema,
  setUILanguage: SetUILanguageActionOptionsSchema,
  completeFTUE: EmptyOptionalSchema,
  completeHook: CompleteHookOptionsSchema,
  refreshComponent: RefreshComponentOptionsSchema,
  addProfile: AddProfileOptionsSchema,
};

export function validateActionPayload(type: string, payload: any): boolean {
  const schema = actionSchemas[type];
  if (!schema) return false;
  const result = schema.safeParse(payload);
  return result.success;
}
