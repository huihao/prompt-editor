# Toolbar Icon Semantic Refresh Design

## Goal

Make every icon-only action in the editor's top toolbar visually consistent and semantically aligned with the action it performs. Prompt Snippets must read as reusable, composable content rather than task completion, while adjacent prompt features remain easy to distinguish.

## Scope

Update only the top toolbar icons in `editor/index.html`. Preserve button IDs, ordering, shortcuts, colors, event handling, and all existing behavior. The target selector and controls outside the top toolbar are out of scope.

## Visual System

Use inline, Lucide-style outline SVGs without adding a runtime or package dependency. Every icon uses a `24 24` view box, `currentColor` stroke, a consistent 2px stroke width, rounded line caps and joins, and the existing 16px rendered dimensions. Existing button fills, accent colors, borders, hover styles, and spacing remain unchanged.

## Icon Mapping

| Toolbar action | Icon | Rationale |
| --- | --- | --- |
| Set Workspace | FolderOpen | Opening or choosing the active project folder |
| History | History | Previous saved prompts and chronological recall |
| Scan Prompt Memory | ScanSearch | Scanning selected sources for reusable prompt knowledge |
| Prompt Snippets | Blocks | Small reusable pieces that can be composed into a prompt |
| Templates | LayoutTemplate | Structured, reusable full-prompt layouts |
| Template Edit Mode | FilePenLine | Editing template structure and content |
| File References | FileSymlink | Linking a workspace file into the prompt |
| AI Enhance Prompt | WandSparkles | AI-assisted transformation or improvement |
| AI Settings | SlidersHorizontal | Configuration and tuning specific to AI behavior |
| Save to History | Archive | Storing the current prompt in the history collection |
| Copy to Clipboard | Copy | Standard clipboard copy action |
| Clear Editor | Eraser | Removing editor content without implying dialog dismissal |
| Paste to Last Position | Send | Preserve the current send metaphor requested by the user |

## Accessibility

Keep each button's existing `title`, including shortcut text. Add a concise `aria-label` to every icon-only toolbar button so its accessible name does not depend on the SVG or tooltip. Mark decorative SVGs `aria-hidden="true"` and prevent them from taking focus.

## Implementation Constraints

- Keep SVG markup inline in `editor/index.html` to match the existing single-file UI structure.
- Do not add an icon package or network-loaded assets.
- Do not rename or reorder buttons.
- Do not modify click, keyboard, context-menu, or native bridge behavior.
- Do not change icons in dialogs, side panels, the snippet manager, or the workspace bar.

## Verification

- Add or update a focused test that parses `editor/index.html` and confirms each toolbar button has the intended icon marker and an accessible label.
- Run the editor test suite and production build.
- Launch the editor locally and inspect the toolbar at desktop and narrow widths in light and dark color schemes, confirming icons render, remain centered, do not shift layout, and are distinguishable.

## Success Criteria

- Prompt Snippets uses the Blocks metaphor instead of the existing circular check mark.
- All top toolbar icons share one outline style and consistent geometry.
- Prompt Memory, Prompt Snippets, Templates, and Template Edit Mode remain visually distinct.
- Paste to Last Position continues to use a Send icon.
- Existing toolbar behavior, layout, colors, shortcuts, and tooltips are unchanged.
- Every icon-only toolbar button has an explicit accessible name.
