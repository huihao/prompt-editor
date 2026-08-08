# Prompt Snippets Interaction Optimization Design

## Goal

Improve the reliability, accessibility, and interaction quality of Prompt Snippets without changing its visible information architecture. The circular snippet picker, tree-based manager list, edit forms, search area, and toolbar remain in place.

## Scope

The work covers the web implementation in `editor/src/snippet-wheel.ts`, `editor/src/snippet-manager-ui.ts`, `editor/src/snippet-manager.ts`, and the existing styles in `editor/index.html`.

The following changes are in scope:

- Repair category collapse and search-reset behavior.
- Prevent event handlers from accumulating when views are re-rendered or the manager is reopened.
- Remove recursive leaf-level empty states while retaining the root empty state.
- Support moving an edited snippet to another category.
- Make built-in categories and snippets read-only in the manager.
- Allow built-in snippets to be copied into editable custom snippets.
- Preserve normal edit and delete behavior for custom data.
- Validate imported JSON and render all imported or user-entered values safely.
- Keep the manager usable in narrow windows without changing its desktop structure.
- Add keyboard navigation, focus management, dialog semantics, and accessible names.
- Replace blocking validation alerts with inline form feedback and expose save progress.
- Warn before discarding unsaved form changes.
- Improve the discoverability of the existing manager entry point without adding a new panel.
- Add automated regression tests for the manager, wheel, and data operations.

The following changes are out of scope:

- Replacing the tree manager with a two-column layout.
- Replacing the circular picker with another component.
- Adding favorites, usage analytics, cloud synchronization, or a new persistence backend.
- Redesigning the global editor toolbar.
- Refactoring the native macOS snippet wheel.

## Interaction Design

### Manager List

The existing toolbar, search input, and category tree remain. Category rows continue to toggle their children when clicked. A category with no children has no disclosure marker and does not render an empty-state block. Expanded state is retained while searching and while moving between list and form views during the same manager session.

Search results continue to replace the tree content. Clearing search restores the tree with working event delegation and the previously retained expansion state. All list actions use one manager-level delegated event handler so re-rendering does not add duplicate handlers.

Built-in rows show their origin and do not offer edit or delete actions. Built-in snippet rows offer a copy action. Copying opens the existing new-snippet form prefilled with the built-in snippet and a generated unique ID; the user chooses the destination category and saves it as custom data. Custom rows retain add, edit, and delete actions.

### Forms

The existing edit form layout remains. Required-field errors appear next to their fields. Save is disabled while persistence is running, and its label communicates progress. The first invalid field receives focus.

Editing a custom snippet may change its category. Saving performs an atomic move in user data and does not create a duplicate. Category IDs and snippet IDs remain immutable after creation.

Cancel, Escape, outside click, and the close button check whether form values differ from their initial values. Dirty forms require discard confirmation; clean forms close or return immediately.

### Picker

The circular visual arrangement remains. Picker items, close, manage, and breadcrumb controls become keyboard-focusable interactive elements with accessible names. Tab reaches all controls. Arrow keys move between circular items, Enter or Space activates the focused item, and Escape retains the current back-or-close behavior.

Opening the picker focuses the first selectable item. Opening the manager focuses search on the list view and the first field on form views. Closing either surface restores focus to the toolbar button that opened it.

### Narrow Windows

At widths below 700 pixels, the manager uses the available viewport width and height, removes the desktop minimum width, disables drag/resize behavior, and allows the toolbar to wrap. The content structure and action order do not change.

## Data Model

Loaded categories and snippets receive an origin classification at lookup time: `built-in` or `custom`. Origin metadata is not exported into the public snippet JSON format.

Built-in data remains immutable. Updates and deletes are accepted only for custom records. The UI derives action availability from the origin classification instead of discovering the restriction after an operation fails.

Moving a custom snippet takes its source and destination category IDs. The manager removes the snippet from the source, inserts it into the destination, saves once, and reloads its maps. A missing source, destination, or duplicate destination ID fails without partially changing stored data.

Imported data must be a versioned object with a categories array. Every category must have a non-empty string ID, name, and icon; every snippet must have non-empty string ID, name, and content. Optional descriptions must be strings. IDs must be unique across their respective entity type. Invalid imports leave current data untouched and return a useful error to the UI.

## Rendering Security

User-controlled values are never concatenated into executable HTML. Static markup may continue to use templates, but names, descriptions, IDs, icons, content, breadcrumbs, options, logs, and search paths are assigned through text/value DOM properties or passed through one strict HTML-escaping helper where DOM construction is impractical.

The same rule applies to manager views and the inline circular picker. Import validation is defense in depth and does not replace output encoding.

## Event Lifecycle

The manager binds persistent overlay-level listeners once when the overlay is created and removes document-level listeners when it closes. View rendering only replaces content and updates state. Drag listeners use stable bound handlers or an abort controller so reopening the manager cannot leave stale document listeners.

Search, tree actions, form submission, and log actions route through delegated handlers or explicitly replaceable handlers. No render method adds a listener that survives the rendered subtree it belongs to.

## Error Handling

Expected validation failures use inline messages and do not log global errors. Persistence and import failures display a non-blocking panel message while preserving the current form or list state. Destructive custom-data actions retain confirmation. Failed operations never optimistically remove visible data.

The reset action awaits data reload before rendering the list. Import reports validation errors without replacing existing storage. Export remains a direct download operation.

## Testing

Tests use Vitest and jsdom and cover behavior through public UI and manager APIs where practical.

Required regression coverage:

- Leaf categories do not render nested empty states.
- Collapse works before and after a search-clear cycle.
- Re-entering list view does not multiply action dispatch.
- Built-in rows are read-only and can be copied.
- Custom rows can be edited and deleted.
- Editing a snippet moves it between categories atomically.
- Invalid imports do not change persisted data.
- Dynamic values render as text rather than markup.
- Reset awaits reload before the list is rendered.
- Dirty forms prompt before discard; clean forms do not.
- Manager and picker restore focus when closed.
- Picker items support arrow-key navigation and Enter activation.
- Manager remains within a 390-pixel viewport.

The full existing test suite and production build must pass. Browser verification covers the desktop manager, search/collapse flow, form validation, picker keyboard flow, and the 390-pixel viewport.

## Success Criteria

- The current Prompt Snippets visual structure remains recognizable and functionally unchanged at the layout level.
- One user action produces one handler invocation after any number of view transitions.
- All visible actions accurately reflect whether an item can be changed.
- No imported or user-entered value can create active markup in the manager or picker.
- All manager and picker workflows can be completed without a pointing device.
- The manager remains fully visible and operable in a 390-pixel-wide viewport.
- Automated tests prevent regressions in the repaired behaviors.
