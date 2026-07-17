import { ZappEntry } from './feed-builder';
import { ActionsBuilder } from './actions-builder';

/**
 * A generic builder for ZappEntry, allowing strongly-typed semantic action construction
 * through a custom TActionBuilder that extends ActionsBuilder.
 */
export class EntryBuilder<
  TActionBuilder extends ActionsBuilder = ActionsBuilder,
> {
  protected entry: any; // Using any to support non-standard Zapp properties like title, content, media_group
  protected actionBuilder: TActionBuilder;

  constructor(
    actionBuilder: TActionBuilder,
    baseEntry: Partial<ZappEntry> = {},
  ) {
    this.entry = { ...baseEntry };
    this.actionBuilder = actionBuilder;
  }

  /**
   * Set the title of the entry
   */
  setTitle(title: string): this {
    this.entry.title = title;
    return this;
  }

  /**
   * Add a cover image to the entry's media_group
   */
  addCoverImage(opts: { url: string | null; key?: string }): this {
    if (!this.entry.media_group) {
      this.entry.media_group = [{ type: 'image', media_item: [] }];
    }

    const mainGroup = this.entry.media_group[0];
    mainGroup.media_item.push({
      key: opts.key || 'image_base',
      src: opts.url,
    });

    return this;
  }

  /**
   * Set the stream content of the entry
   */
  setStream(opts: { url: string; type?: string }): this {
    this.entry.content = {
      src: opts.url,
      type: opts.type || 'application/octet',
    };
    return this;
  }

  /**
   * Add generic extensions
   */
  addExtension(key: string, value: any): this {
    if (!this.entry.extensions) {
      this.entry.extensions = {};
    }
    this.entry.extensions[key] = value;
    return this;
  }

  /**
   * Add actions using the specific action builder
   */
  addActions(): TActionBuilder {
    return this.actionBuilder;
  }

  /**
   * Build actions for an entry_action menu item
   */
  addEntryAction(
    title: string,
    iconURL: string,
    actionBuilder: ActionsBuilder,
    dismissOnAction: boolean = true,
  ): this {
    const tapActions = actionBuilder.build().extensions?.tap_actions;
    const actions = tapActions ? tapActions.actions : [];

    if (!this.entry.extensions) this.entry.extensions = {};
    if (!this.entry.extensions.entry_action)
      this.entry.extensions.entry_action = [];

    this.entry.extensions.entry_action.push({
      button: {
        title,
        iconURL,
      },
      dismiss_on_action: dismissOnAction,
      actions,
    });

    return this;
  }

  /**
   * Build the final ZappEntry
   */
  build(): ZappEntry {
    // Build the actions which will inject tap_actions (or other actions) into extensions
    const actionEntryPart = this.actionBuilder.build();

    return {
      ...this.entry,
      ...actionEntryPart,
      extensions: {
        ...(this.entry.extensions || {}),
        ...(actionEntryPart.extensions || {}),
      },
    };
  }
}
