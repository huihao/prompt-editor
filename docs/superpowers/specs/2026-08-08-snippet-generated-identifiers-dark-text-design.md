# Generated Snippet Identifiers and Dark Text Contrast

## Goal

Remove manual identifier entry from new Prompt Snippet and Category workflows, and ensure all manager text remains readable on its dark background without changing the visible page structure.

## Identifier Behavior

- New snippets receive an identifier before the form is rendered.
- New categories receive an identifier before the form is rendered.
- Identifiers use `crypto.randomUUID()` with `snippet-` or `category-` prefixes.
- Environments without `crypto.randomUUID()` fall back to a timestamp plus random suffix.
- Creation forms do not display the identifier field.
- Edit forms display the identifier as a disabled, immutable field.
- Copying a built-in snippet generates a fresh snippet identifier rather than deriving one from the source identifier.
- Existing persistence-level duplicate checks remain in place as a final guard.

## Dark Theme Contrast

- The existing manager layout, hierarchy, and controls remain unchanged.
- The manager modal establishes an explicit near-white foreground color on dark backgrounds.
- Headings, labels, tree rows, search results, buttons, inputs, textareas, selects, and close controls inherit or explicitly use the light foreground.
- Placeholder and helper text use a lighter muted gray that remains readable.
- Existing success, error, focus, and primary-action colors retain their semantic colors.
- Light-theme behavior remains unchanged.

## Testing

- Verify new snippet and category forms contain generated IDs internally but do not render an ID input.
- Verify edit forms retain a disabled ID input.
- Verify copied snippets receive a fresh generated ID.
- Verify generated IDs have the expected prefixes and are distinct.
- Verify the dark-theme CSS contains explicit light foreground rules.
- Run the complete test suite and production build, then inspect the manager in a browser.
