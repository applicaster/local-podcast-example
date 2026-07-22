
# Behaviors

Enables visual (non-interactive) highlight for the cell/cells based on the match of an entry property (usually `id`) and a constant or some app state dynamic value:
- storage key (`@{ctx/namespace.key}`)
- screen state key (`@{screen/key}`)
- currently played entry id (`now_playing`, always single-select) (todo: need to change to `@{player/entry.id}`. Currently its not exposed and comes from Zapp cell style, so not a problem)
- subscribed push topics (`@{push/topics}`, always multi-select)
- and so on.
Can be combined with actions to make component behave as a single/multiselect UI control.

#### SingleSelect

`current_selection` can use an `@ notation` path or a *string* value.
`selector` is a dot separated path to the entry property that will be compared with the `current_selection` resolved value. Entry id will be used if field is not provided.

```
  "behavior": {
    "select_mode": "single",
    "current_selection": "@{ctx/user_preferences.genres}",
    "selector": "extensions.tag"
  }
```

Constant current selection can be used for example to highlight a specific cell:

```
  "behavior": {
    "select_mode": "single",
    "current_selection": "premium",
    "selector": "extensions.subscription_type"
  }
```

#### MultiSelect

Constant `current_selection` is passed as an **array** of values (**NOT** a comma-separated strings!):

```
  "behavior": {
    "select_mode": "multi",
    "current_selection": ["horror", "action", "comedy"],
    "selector": "extensions.tag"
  }
```

`current_selection` can also use an *@ notation* path to use dynamic value resolving. For some value providers (storages, screen data) `select_mode` is required to interpret storage value (always a string) as an array of comma-separated values.

```
  "behavior": {
    "select_mode": "multi",
    "current_selection": "@{ctx/user_preferences.genres}",
    "selector": "extensions.tag"
  }
```

# Actions

Basic actions that can be executed on a cell click and from some other triggers.

# Actions list

## Generic actions

### sendCloudEvent

If `inflateData` is **true**, data params that use **@ syntax** will be inflated.

```
{
  "type": "sendCloudEvent",
  "options": {
    "url": "https://tbn-dsp-curation-api-stage.tbnstage.com/v1/save_network",
    "type": "com.applicaster.selector.action.v1",
    "subject": "preference_selection",
    "data": {
       "entry": "@{entry/}",
       "pin_code": "@{ctx/parent_lock.pin}",
       "const_value": "some_value"
     },
     "inflateData": true,
  }
}
```

### appRestart

Performs application hot restart. **Must be the last action in the list**.

```
{
  "type": "appRestart"
}
```

### switchLayout

Layout selection is persistent, but only applied if the Layout Manager Plugin is not present in the app.

```
{
  "type": "switchLayout",
  "options": {
    "layoutId": "5c1e9884-3161-4be4-8519-224392b8ee86"
  }
}
```

Can be combined with a `behavior` feed extension to highlight an entry corresponding to the current layout. `selector` can be used when layout id is stored in the entry extension instead of entry id.

```
"behavior": {
  "current_selection": "@{ctx/active_layout_id}",
  "select_mode": "single"
}
```

### navigateToScreen

Navigates to the screen associated with type provided in `typeMapping`. Recommended to be the last action in the list.

Options:
- `typeMapping` (required): target screen type.
- `navigationAction` (optional): `push` or `replace`. Uses `replace` by default.
- `entry` (optional): entry object (or value resolver expression) used as navigation payload.

If `entry` is resolved and is an object, navigation uses this entry as payload and overrides `entry.type.value` with `typeMapping`.
If `entry` is not provided, plugin resolves screen by `typeMapping` and navigates to mapped river.

```
{
  "type": "navigateToScreen",
  "options": {
    "typeMapping": "devices"
  }
}
```

Navigate with push action and pass current entry context:

```
{
  "actions": [
    {
      "type": "navigateToScreen",
      "options": {
        "typeMapping": "stats",
        "navigationAction": "push",
        "entry": "@{entry/}"
      }
    }
  ]
}
```

## Screen scoped actions

Note that unlike storage, screen state is not persistent and will be lost when the screen is closed, and does not have namespace.

### screenSetVariable

Sets screen state variable to a value.
Value is taken:
* from the path stored in `selector` property if present in options. If path is missing in entry or values is not string, error will be thrown.
* `entry.extensions.tag` if present.
* `entry.id` otherwise.

Note that syntax for screen statie is different from storage: it only accepts single value, and there is no namespaces.

```
{
  "type": "screenSetVariable",
  "options": {
    "key": "apply_filter",
    "value": "true",
    "selector": "extensions.tag"
  }
}
```

### screenToggleFlag

Adds or removes tag to comma separated list of unique tags in screen state variable.
Value is taken:
 * from `tag` option, if present. Does not require entry context in this case. TODO: Not implemented yet!
 * from the path stored in `selector` property if present in options. If path is missing in entry or values is not string, error will be thrown.
 * `entry.extensions.tag` if present.
 * `entry.id` otherwise.

```
{
  "type": "screenToggleFlag",
  "options": {
    "key": "selected_genres",
    "tag": "horror",
    "selector": "extensions.tag"
  }
}
```

### refreshComponent

Reloads feed backing up current component.
Later, ability to pass components ID or data feeds URLs to be refreshed will be added.
```
{
  "type": "refreshComponent",
  "options": {}
}
```

## Language selector plugin actions

### setUILanguage

Sets app language and restarts the application to apply the change.
If `noConfirmation` is set to true, the action will be executed without confirmation dialog.

```
{
  "type": "setUILanguage",
  "options": {
    "languageCode": "en-UK",
    "noConfirmation": true
  }
}
```

## Storage Actions

### localStorageSet

Sets local storage keys values in for namespaces provided in `content` option.

```
{
   "type": "localStorageSet",
   "options": {
      "content": {
         "user_preferences": {
            "profile": 154970
         }
      }
   }
}
```

### sessionStorageSet

Sets session storage keys values in for namespaces provided in `content` option.

```
{
   "type": "sessionStorageSet",
   "options": {
      "content": {
         "user_preferences": {
            "profile": 154970
         }
      }
   }
}
```

### localStorageRemove

Removes the requested keys from local storage for the namespaces provided in the `content` option. Unlike `localStorageSet`, each namespace maps to an **array of key names** to remove (no values).

```
{
   "type": "localStorageRemove",
   "options": {
      "content": {
         "user_preferences": ["profile", "genres"]
      }
   }
}
```

### sessionStorageRemove

Removes the requested keys from session storage for the namespaces provided in the `content` option. Unlike `sessionStorageSet`, each namespace maps to an **array of key names** to remove (no values).

```
{
   "type": "sessionStorageRemove",
   "options": {
      "content": {
         "user_preferences": ["profile", "genres"]
      }
   }
}
```

### localStorageToggleFlag

Adds or removes tag to comma separated list of unique tags in local storage key in the provided namespace.
Tag value is taken:
 * from `tag` option, if present. Does not require entry context in this case. TODO: Not implemented yet!
 * from the path stored in `selector` property if present in options. If path is missing in entry or values is not string, error will be thrown.
 * `entry.extensions.tag` if present.
 * `entry.id` otherwise.
Note that unlike `localStorageSet`, only single key is supported in the options, since passing multiple namespaces and keys does not makes sense.

`max_items` is the maximum number of items that can be stored in the list. If the limit is reached, item will not be added, and `cancel` will be generated. No limit by default.

```
{
   "type": "localStorageToggleFlag",
   "options": {
      "key": "user_preferences.genres",
      "tag": "horror",
      "selector": "extensions.genre_tag",
      "max_items": 3
   }
}
```

### sessionStorageToggleFlag

Adds or removes tag to comma separated list of unique tags in session storage key in the provided namespace.
Tag value is taken:
 * from `tag` option, if present. Does not require entry context in this case. TODO: Not implemented yet!
 * from the path stored in `selector` property if present in options. If path is missing in entry or values is not string, error will be thrown.
 * `entry.extensions.tag` if present.
 * `entry.id` otherwise.
Note that unlike `sessionStorageSet`, only single key is supported in the options, since passing multiple namespaces and keys does not makes sense.

`max_items` is the maximum number of items that can be stored in the list. If the limit is reached, item will not be added, and `cancel` will be generated. No limit by default.

```
{
   "type": "localStorageToggleFlag",
   "options": {
      "key": "user_preferences.genres",
      "selector": "extensions.genre_tag",
      "tag": "horror",
      "max_items": 3
   }
}
```

To do: Owned keys concept (“named key set”)

## UI actions

### openBottomSheet

Opens a bottom sheet menu surface specified by header and content options.

```json
{
  "type": "openBottomSheet",
  "options": {
    "modal_presentation": {
      "type": "bottom_sheet",
      "style_variant": "modal_bottom_sheet"
    },
    "header": {
      "title": "Edit Playlist",
      "subtitle": "My Playlist"
    },
    "content": {
      "title": "My Playlist",
      "itemsUrl": "https://server.com/user/collections/123?editable=true",
      "items": []
    }
  }
}
```

### editCollectionName

Triggers a flow or dialog to edit a collection's display name.

```json
{
  "type": "editCollectionName",
  "options": {
    "collectionId": "playlist-123",
    "name": "Current Playlist Name"
  }
}
```

### confirmDialog

Shows a confirmation dialog with provided message and title. If the user confirms, next action in the array will be executed. If the user cancels, execution chain will be cancelled without generating error.

```
{
  "type": "confirmDialog",
  "options": {
    "message": "Region will be changed to UK. Are you sure you want to continue?",
    "title": "Region change",
    "okButtonText": "Yes",
    "cancelButtonText": "No"
  }
}
```

## First time user experience plugin actions

Available while First time user experience screen is open.

### completeFTUE

Completes and closes the currently opened First time user experience screen. Has no options at the moment.

```
{
   "type": "completeFTUE"
}
```

## Screen Hook Wrapper actions

### finishHook

Completes the currently opened screen hook wrapper hook with a desired result. Later will be available in the context of any hook.

```
{
   "type": "finishHook"
   "options": {
     "success": true
   }
}
```

```
{
   "type": "finishHook"
   "options": {
     "errorMessage": "You shall not pass!"
   }
}
```

Note: error will be logged to the x-ray, but will not be shown to the user.

# Roles

Roles are feed extensions that transform feeds on load by automatically injecting suitable actions and behaviors.

### push_topic

Makes the feed able to control push topics. Topic id comes from entry ID or path configured on the plugin level, like `extensions.tag`. Note that properties like `selector`, `initial_value` etc. are not supported, everything is controlled by push plugins configuration.

```
"extensions": {
  "role": "push_topic"
}
```

### language_selector

Makes feed perform as Language Selector feed by automatically injecting `setUILanguage` action and single selection behavior feed extensions. Language code is taken from `extensions.tag` if present, or entry `id`. Language code must match codes entered in Zapp Application settings.

### preference_editor

Role allows to set/remove/modify values in the local and session storages, or screen state.

#### Tags (multiselect) mode

Adds ability to use some storage values as *a comma separated list* of unique tags.

Optional key `scope` allows to select target storage level: "local", "session", "screen". Default is "local" (persistent).

Optional keys `initial_value` or `current_value` can be provided. Only one of them should be passed.
`initial_value` is used initialize the value in the storage, it its not present.
`current_value` is used to overwrite the value in the storage, even if it's already present.
Note that unlike behavior, key does not accept arrays, since storages only work with string types
TODO: we can add typecheck and additional processing to support both formats for convenience.

`max_items` is the maximum number of items that can be selected at once. Optional, no limit by default. Message will be presented if user attempts to add value over the limit. Note that if storage already holds values over the limit (for example ifvalue was loaded externally or the limit was introduced later), it will not be truncated.

Feed extension:

```
"extensions": {
  "role": "preference_editor",
  "preference_editor_options": {
    "select_mode": "multi",
    "key": "user_preferences.genres",
    "scope": "local",
    "initial_value": "horror,action,comedy",
    "current_value": "horror,action,comedy",
    "max_items": 3
  }
}
```

Old format with explicit `behavior` block to indicate selection mode (QB 13).

```
"extensions": {
  "role": "preference_editor",
  "behavior": {
    "select_mode": "multi",
    "current_selection": "@{ctx/user_preferences.genres}"
  },
  "preference_editor_options": {
    "key": "user_preferences.genres"
    "initial_value": "horror,action,comedy",
    "current_value": "horror,action,comedy",
    "max_items": 3
  }
}
```

Tag value is taken from entry `extensions.tag` if present, or entry id otherwise.
Entry extension example (optional):

```
"extensions": {
  "tag": "horror"
}
```

#### Single option (radiobutton) mode

Stores only single current value.

Optional key `scope` allows to select target storage level: "local", "session", "screen". Default is "local" (persistent).

Optional keys `initial_value` or `current_value` can be provided. Only one of them should be passed.
`initial_value`  is used initialize the value in the storage, it its not present.
`current_value` is used to overwrite the value in the storage, even if it's already present.

```
"extensions": {
  "role": "preference_editor",
  "preference_editor_options": {
    "select_mode": "single",
    "key": "user_preferences.region",
    "scope": "local",
    "initial_value": "us",
    "current_value": "us"
  }
}
```

Old format with explicit `behavior` block to indicate selection mode (QB 13).

```
"extensions": {
  "role": "preference_editor",
  "behavior": {
    "select_mode": "single",
    "current_selection": "@{ctx/user_preferences.region}"
  },
  "preference_editor_options": {
    "key": "user_preferences.region",
    "initial_value": "us",
    "current_value": "us"
  }
}
```

Value is taken from entry `extensions.tag` if present, or entry id otherwise.
Passing `selector` to generated behavior is not currently supported.

### collection_selector

Used for feeds where the user selects items or collections (e.g., choice lists or playlist selection). Works with a `behavior` block defining `select_mode` (`single` | `multi`) and `current_selection`.

```json
"extensions": {
  "role": "collection_selector",
  "behavior": {
    "select_mode": "multi",
    "current_selection": ["playlist-1"]
  }
}
```

### dynamic_collection

Declares an editable collection feed (e.g., custom playlists, playback queue) where items can be managed dynamically (reordered, removed, added, deleted).

```json
"extensions": {
  "role": "dynamic_collection",
  "dynamic_collection_options": {
    "postUrl": "https://server.com/cloud-events",
    "operations": "remove,reorder"
  }
}
```

# Preferences screen with Apply button

We will introduce ActionsApplierContext context. If it's not provided, actions are triggered on cell tap.
If context exists (i.e. we are inside PreferencesScreen and the actions array has a Delayed flag), the actions array will be submitted to the context with component ID instead of action executor (we can basically have root context implementation that applies immediately, and just override it on the stack, or use pure JS approach).
ActionsApplierContext will keep track of the submitted actions and also replace actions submitted by the component, if the component will send a new action set (so we do not accumulate actions from one component when the user changes selection multiple times).
When there are accumulated actions, the Apply button will be active.
