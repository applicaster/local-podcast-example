import { z } from 'zod';

const AppRestartSchema = z.object({}).optional();

const SwitchLayoutSchema = z.object({
  layoutId: z.string().min(1),
});

const NavigateToScreenSchema = z.object({
  typeMapping: z.string().min(1),
});

const SetUILanguageSchema = z.object({
  languageCode: z.string().min(1),
  noConfirmation: z.boolean().optional(),
});

const CompleteFTUESchema = z.object({}).optional();

const CompleteHookSchema = z
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

const ToggleStorageFlagSchema = z
  .object({
    key: z.string().min(1),
    max_items: z.number().optional(),
    selector: z.string().min(1).optional(),
    tag: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      // tag and selector are mutually exclusive
      if (data.tag && data.selector) return false;
      return true;
    },
    {
      message: "Only one of 'tag' or 'selector' may be present.",
      path: ['tag', 'selector'],
    },
  );

const LocalStorageSetSchema = z.object({
  content: z.record(z.string(), z.record(z.string(), z.any())),
});

const SessionStorageSetSchema = z.object({
  content: z.record(z.string(), z.record(z.string(), z.any())),
});

const ScreenSetVariableSchema = z.object({
  key: z.string(),
  value: z.any(),
});

const SendCloudEventSchema = z.object({
  url: z.string().min(1),
  inflateData: z.boolean().optional(),
});

export const actionSchemas: Record<string, z.ZodTypeAny> = {
  localStorageToggleFlag: ToggleStorageFlagSchema,
  sessionStorageToggleFlag: ToggleStorageFlagSchema,
  screenToggleFlag: ToggleStorageFlagSchema,
  localStorageSet: LocalStorageSetSchema,
  sessionStorageSet: SessionStorageSetSchema,
  screenSetVariable: ScreenSetVariableSchema,
  sendCloudEvent: SendCloudEventSchema,
  appRestart: AppRestartSchema,
  switchLayout: SwitchLayoutSchema,
  navigateToScreen: NavigateToScreenSchema,
  setUILanguage: SetUILanguageSchema,
  completeFTUE: CompleteFTUESchema,
  completeHook: CompleteHookSchema,
};

export function validateActionPayload(type: string, payload: any): boolean {
  const schema = actionSchemas[type];
  if (!schema) return false;
  const result = schema.safeParse(payload);
  return result.success;
}
