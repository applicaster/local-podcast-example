import { z } from 'zod';

export const PreferenceEditorOptionsSchema = z.object({
  key: z.string(),
  scope: z.enum(['local', 'session', 'screen']),
  select_mode: z.enum(['single', 'multi']),
  max_items: z.number().optional(),
  current_value: z.union([z.string(), z.array(z.string())]).optional(),
  initial_value: z.union([z.string(), z.array(z.string())]).optional(),
});

export const BehaviorSchema = z.object({
  select_mode: z.enum(['single', 'multi']),
  current_selection: z.union([z.string(), z.array(z.string())]),
});

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
