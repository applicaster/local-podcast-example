## Base definitions

**Action** - [Actions.md](Actions.md) named function with optional set of arguments that performs something useful: writes to storage, sends cloud event, restarts the application and so on. Can be application-wide level, provided by plugins, confined to screen. Actions can be triggered by varios events: cell tap, user login, feed reload (currently supported in Remote Context Setter plugin) and so on.

**Action executor** - class that holds registry of the actions and can execute them. Application can have multiple executors, which can have separate sets of actions, or override behavior of higher level executor.

**Behavior** - description of how feed should be rendered in the component. Currently, the only supported feature is conditional cell highlighting. Later additional options can be added, for example, should component visually indicate that feed is been refreshed (with alpha/tint pulse, for example).

**Role** - domain specific meaning of the feed and its items: preferences (`preference_editor`), collection selection (`collection_selector`), editable collections (`dynamic_collection`), push topics (`push_topic`), languages (`language_selector`), etc. Roles are interpreted by feed decorators and client renderers to pick appropriate cell styles, affordances, actions, and behaviors.

**Resolver** - interface that returns actual value of some variable in some internal or remote state, object or generated values. Value can be string (`ctx/namespace.key`), boolean, number (`random/int`), object (`entry/extensions.channel_id`), string array (`push/topics`) and so on. Resolvers can be used in multiple places: As endpoint params to build HTTP request, analytics event creation and so on. 

**Value provider** - interface that provides REST-like reactive (observable) API to values inside application (storages, push topics, currently playing item) or remote ones. Currently value providers can only support single string value or array of string values. **Resolvers** can be implemented as wrappers on top of Value providers.

**Entry**
JSON object representing a single item of some kind: video, purchasable item, TV series, TV season and, some event, so on. Has `id` field and some `type`, can also have additional fields like `title` and `summary`, and `media_group` with images/video thumbnails. Can also include `extensions`, a JSON object that contains a number additional fields: JSON primitives, arrays or objects, representing data associated with specific entry. Examples can be "Continue Watching" extension, containing progress of watched video, "Calendar", containing event start and end date-time.

**Feed**
HTTP request (combination of url, headers, query parameters and body parameters), usually GET, to load data, usually list of **entries**. POST request can return other data (not feeds), or not return anything at all except of status code.
Feed url can define parameters with special syntax (wrapped in curly braces: `{{parameter_name}}`) that indicates that actual value should be provided at runtime.
Like entries, feeds can have `extensions`.

**Endpoint**
A way to specify a set of shared HTTP params for a group of feeds based on the best url match.
Params include:
    - Headers
    - Query parameters
    - Body parameters
    - Authentication method
    - Context keys (special type of query parameter, base64 encoded json dictionary)
Parameters are defined as a list: (value source, parameter type, \[rename\]).
Resolvers are used to provide actual values for defined parameters during request building process: url inflation and collecting parameters.

**Screen**
Represents single screen in the application. Can display **Components**, be completely custom (Login, WebView screen) or be mix of the two (Storefront utilizes component to present purchase options).
Can also display some navigation elements: bottom tabs, side menu, top bar.

**Hook**
A way to present a screen that can deliver some result: login result, purchase result, access check result, etc. An array of hooks can be assigned to some screen, and they will be presented in sequence before navigation to the target screen. If some hook returns failure or cancellation result, navigation is aborted.

**Cell style**
A set of parameters describing how a single **entry** from the **feed** is represented visually: relative location and styles of the images, labels and buttons. Some cell styles are specific for component, like Cell Info style can only be used with Group Info component. Other collection-type components usually can use same cell styles.

**Component**
Configurable widget that can be rendered on the screen. Can be separated into two main families: components that render feeds, and other components.
Feed based components present entries from the feed as cells using some cell style associated with the component.
Feed based components can actively observe feed url dependencies and trigger reload (enabled by `observe_storage` **endpoint tag**).

**Nav item**
Interactive or pure visual element in the navigation part of the screen. Can wrap Entry Actions (download, add to favorites and so on), or be application-wide (toggle some setting or execute generic action list).

**Application states**

Application contains a number of entities that represent some state:
- Local storage
- Session storage
- Current screen state
- Current primary player state

These states can be mutable, either directly or by interacting with an entry that provides the state (like Player or Push plugin). Some entities can expose specific **Actions** to modify the state, others can be only accessible from code or via Value providers.

## Case studies

### Screen with tabs

Two components.
 - First component represents tabs and uses a `preference_editor` role with `screen` scope, so clicking on an item stores some value from the entry in screen state under defined key.
 - Second component observes same key and uses a key value as a part of endpoint params or component data filter expression.
Internally, first component executes automatically inflated action that writes new key value to the screen state, and behavior to highlight item that corresponds to the current key value. Second component subscribed to the same value provider bound to the key.

### Screen with multiple tags group filters

One component per each tag group. For example: type (movie/show/live/TV), genre (action/comedy/horror), duration range (short, long). Each feed has a `preference_editor` role with `screen` storage scope and `multi` selection mode.

One component for results that uses all tag groups from previous components as endpoint params.

If roles are persisted in local storage, they can be used to fetch data on other screens, i.e. serve as persistent preference.
Internally works the same way as Screen with tabs case.

### Search screen

Two components.
 - Text input that writes to a key value to screen state.
 - Result component that uses endpoint that has that screen state key as a parameter.

### Subscriber / non-subscriber content filtering

Goal: show or hide content rails based on user entitlement (`subscription` state), and refresh the screen when user logs in, logs out, or account state changes.

#### Solution A: hidden component + observed endpoint key

A hidden feed component is placed near the top of the screen and fetches account data. Its feed/actions write `user_account.subscription` to storage.

Content feeds are migrated to subscription-aware backend paths (for example, filtered playlists or filtered links) and use an endpoint that includes context key `user_account.subscription` plus `observe_storage` tag.

When `user_account.subscription` changes, all dependent feeds reload automatically. Backend returns either filtered data or empty feeds, so UI adapts without dedicated entitlement logic in each component.

Trade-offs:
- Works even when runtime context setter capabilities are not uniformly available across platforms.
- Self-contained in layout configuration.
- Adds a non-obvious hidden dependency and can affect screen composition/positioning if component order is wrong.

#### Solution B: Remote Context Setter Runtime URL

Instead of a hidden component, Context Setter plugin runtime URL calls Get Context API and writes subscription data directly to `storage_keys` or `persistent_keys`.

Same subscription-aware endpoints are used by content feeds, still with `observe_storage`. When auth/state keys change, runtime request is re-fetched and dependent feeds reload with the new `user_account.subscription` value.

Recommended logout behavior: backend returns same user keys with `null` values to explicitly purge user-scoped data.

Trade-offs:
- Cleaner architecture (no hidden UI component used for data sync).
- Centralized and reusable across screens.
- Depends on platform/plugin support for runtime URL behavior.

### Role/Behavior-Driven Rendering & Dynamic Collections (Phase 3 Backend Contract)

The backend drives UI presentation by declaring semantic **`role`**, **`behavior`**, and **`dynamic_collection_options`** extensions on feeds:

1. **Source-Driven Semantics**:
   - The backend specifies **`role`** (`collection_selector`, `preference_editor`, `dynamic_collection`).
   - The client renderer owns visual presentation (cell widgets, icons, controls).
   - **`style_variant` is not a rendering input** — row layout and affordances are driven exclusively by `role` and `behavior`.

2. **Orthogonality of Selection & Editing**:
   - **Selection (`behavior`)**: Controls choice UI widgets (`select_mode`: `single` | `multi`, `current_selection`, `selector`).
   - **Editing (`dynamic_collection`)**: Controls collection mutation capabilities via `dynamic_collection_options`:
     - `postUrl`: Remote endpoint for dispatching Cloud Events on mutations.
     - `operations`: Allowed operations string (e.g. `"remove,reorder"`).

3. **Cloud Event Synchronization**:
   - Remote-backed dynamic collections dispatch Cloud Events (`com.applicaster.collection.remove.v1`, `com.applicaster.collection.delete.v1`, etc.) to `postUrl`.
