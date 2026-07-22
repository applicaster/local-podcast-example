import { ValidatePreferencesRoleFeed } from './decorators';

export type StorageScope = 'local' | 'session' | 'screen';
export type SelectMode = 'single' | 'multi';

export interface ZappEntry {
  id?: string;
  type?: any;
  extensions?: Record<string, any>;
}

export interface ZappFeed {
  id?: string;
  title?: string;
  extensions?: Record<string, any>;
  entry?: ZappEntry[];
}

/**
 * Options for building a preference editor feed.
 *
 * - `storage`: Storage scope for the preference ("local", "session", or "screen"). Default: "local".
 * - `type`: Selection mode ("single" or "multi"). Default: "single".
 * - `key`: Storage key for the preference. Required.
 * - `initialValue`: Initial value to set if not present in storage.
 * - `currentValue`: Value to overwrite in storage (takes precedence over initialValue if both are set).
 * - `maxItems`: Maximum number of items that can be selected (for multi-select).
 * - `title`: Feed title.
 * - `entries`: Array of feed entries (each entry is a partial ZappEntry).
 * - `actionBuilder`: Optional callback to pre-inflate actions for each entry. If provided, disables client-side action inflation and omits `role: "preference_editor"` from the feed.
 *
 * Example usage:
 * ```ts
 * buildPreferenceFeed({}, {
 *   storage: "local",
 *   type: "multi",
 *   key: "genres",
 *   entries: [ { id: "horror" }, { id: "comedy" } ],
 *   actionBuilder: entry => new ActionsBuilder(entry).toggleStorageFlag({ key: "genres" }).build()
 * })
 * ```
 */
export interface PreferenceFeedOptions {
  storage?: StorageScope;
  type?: SelectMode;
  key: string;
  initialValue?: string | string[];
  currentValue?: string | string[];
  maxItems?: number;
  title?: string;
  entries?: Array<Partial<ZappEntry>>;
  actionBuilder?: (entry: Partial<ZappEntry>) => ZappEntry;
}

/**
 * Builds a ZappFeed for a preference editor role, with optional pre-inflated actions.
 *
 * If `actionBuilder` is provided in options, each entry will be passed through the callback to pre-inflate actions,
 * and the resulting feed will NOT include `role: "preference_editor"` (disabling client-side action inflation).
 *
 * If `actionBuilder` is not provided, the feed will include `role: "preference_editor"` and the client is expected to handle action inflation.
 *
 * @param feed Partial base feed object to extend.
 * @param opts Options for preference feed construction (see PreferenceFeedOptions).
 * @returns A ZappFeed object ready for use on client or server.
 */
export function buildPreferenceFeed(
  feed: Partial<ZappFeed>,
  opts: PreferenceFeedOptions,
): ZappFeed {
  const scope = opts.storage || 'local';
  const select_mode = opts.type || 'single';
  if (!opts.key) {
    throw new Error("PreferenceFeedOptions: 'key' is required");
  }
  const key = opts.key;

  const prefOptions: Record<string, any> = {
    key,
    scope,
    select_mode,
    max_items: opts.maxItems,
  };
  if (opts.currentValue !== undefined) {
    prefOptions.current_value = opts.currentValue;
  } else if (opts.initialValue !== undefined) {
    prefOptions.initial_value = opts.initialValue;
  }

  let extensions: any = {
    ...(feed.extensions || {}),
    preference_editor_options: prefOptions,
    role: 'preference_editor',
  };

  let entries = opts.entries || feed.entry || [];

  // If actionBuilder is provided, pre-inflate actions and add behavior block
  if (opts.actionBuilder) {
    entries = entries.map((e) => opts.actionBuilder!(e));
    extensions.behavior = {
      select_mode,
      current_selection: `@{${scope}/${key}}`,
    };
  }

  return {
    ...feed,
    title: opts.title || feed.title,
    extensions,
    entry: entries,
  } as ZappFeed;
}

// // Sample service using the decorator
// export function buildValidatedPreferenceFeed(
//     feed: Partial<ZappFeed>,
//     opts: PreferenceFeedOptions
// ): ZappFeed {

//     class Builder {

//         @ValidatePreferencesRoleFeed
//         buildPreferenceFeed(
//             feed: Partial<ZappFeed>,
//             opts: PreferenceFeedOptions
//         ): ZappFeed {
//             return buildPreferenceFeed(feed, opts)
//         }

//     }

//     return new Builder().buildPreferenceFeed(feed, opts);
// }
