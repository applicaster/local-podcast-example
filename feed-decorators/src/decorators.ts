import { ZappFeedSchema } from './zod-definitions';
import { validateActionPayload } from './action-validators';

/**
 * Decorator to validate the output of a feed builder function and all actions in its entries.
 * Throws an error if validation fails.
 */
export function ValidatePreferencesRoleFeed(
  target: Function,
  context: { kind: string; name: string },
) {
  if (context.kind === 'method') {
    return function (this: unknown, ...args: any[]) {
      const result = target.apply(this, args);
      // Validate feed structure
      const feedParse = ZappFeedSchema.safeParse(result);
      if (!feedParse.success) {
        throw new Error(
          `Feed validation failed: ${JSON.stringify(
            (feedParse as any).error.issues,
            null,
            2,
          )}`,
        );
      }
      // Validate actions in entries
      if (result.entry && Array.isArray(result.entry)) {
        for (const entry of result.entry) {
          const actions = entry?.extensions?.tap_actions?.actions;
          if (Array.isArray(actions)) {
            for (const action of actions) {
              if (!validateActionPayload(action.type, action.options)) {
                throw new Error(
                  `Action validation failed for type '${
                    action.type
                  }': ${JSON.stringify(action.options)}`,
                );
              }
            }
          }
        }
      }
      return result;
    };
  }
  return target as any;
}
