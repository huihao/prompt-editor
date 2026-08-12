# Prompt Editor App Icon Design

## Summary

Prompt Editor will use a new visual identity named **Prompt Forge**. The mark combines a white document with an AI wand and spark, communicating prompt editing and AI enhancement in one recognizable symbol. The identity covers the desktop applications, system tray and menu bar, website favicon, and a horizontal website brand lockup.

## Goals

- Make prompt editing and AI assistance understandable at a glance.
- Remain recognizable from a 1024 px store asset down to a 16 px favicon or tray icon.
- Present a friendly, vivid AI personality while retaining the clarity expected of a developer tool.
- Use one shared brand mark across macOS, Windows, Linux, and the website.
- Supply native formats and platform-appropriate padding instead of reusing one raster unchanged everywhere.

## Non-goals

- Renaming Prompt Editor or adding a slogan.
- Redesigning the application interface or website beyond icon and brand-mark integration.
- Adding letters or words inside the app icon.
- Replacing existing toolbar icons, which are functional controls rather than brand assets.

## Core Mark

The primary icon uses a vivid rounded-square field with three foreground elements:

1. A white document tilted approximately 6 degrees counterclockwise, with a subtle folded corner and three simplified colored text lines.
2. A dark wand crossing the document at approximately 43 degrees, with a pale yellow tip.
3. A four-point pale yellow spark in the upper-right area.

The document is the dominant shape. The wand overlaps its lower-right edge, and the spark remains visually separate from both. The composition occupies approximately 72% of the safe canvas, leaving enough clear space for platform masks and small-size rendering.

## Visual Style

The icon should feel bright, approachable, and polished rather than technical or austere. Forms are geometric and simplified, with controlled depth from soft shadows and a restrained highlight. Avoid photorealistic materials, excessive glass effects, fine text, noisy texture, and tiny secondary sparkles.

The master image should be rendered at 1024 x 1024 pixels without an externally applied platform mask. All important content must remain inside the central safe area so that macOS, Windows, Linux, and web derivatives can apply their own framing.

## Color Palette

| Role | Color | Use |
| --- | --- | --- |
| Violet | `#6657F5` | Upper-left background anchor |
| Purple | `#A64DDD` | Background transition |
| Pink | `#F04F88` | Lower-right background anchor and document accent |
| Spark yellow | `#FFF39A` | Spark and wand tip |
| Wand ink | `#302052` | Wand body and high-contrast detail |
| Paper white | `#FFFFFF` | Document |

The background transitions diagonally from violet through purple to pink. The final asset may make small color adjustments for contrast and gamut consistency, but it must preserve this relationship and avoid a muddy or predominantly blue result.

## Small-size Behavior

- At 64 px and above, preserve the document fold, three text lines, wand, and spark.
- At 32 px, simplify the fold and line details if needed; the document silhouette, wand, and spark must remain distinct.
- At 16 px, prioritize the background, white document mass, and spark. Details that create blur may be omitted.
- The favicon may use a dedicated simplified variant consisting of the gradient field and large spark when the full mark is not legible.
- Tray and menu bar assets use a dedicated single-color outline. They must not be grayscale conversions of the full-color app icon.

## Platform Deliverables

### Source and shared assets

- A 1024 x 1024 PNG master with no platform mask baked into the canvas.
- A transparent PNG of the standalone mark and an SVG horizontal website lockup assembled from the approved mark and live vector wordmark.
- A documented generation prompt and any deterministic post-processing commands used to derive assets.

### macOS

- `PromptEditor.icns` containing standard macOS icon representations through 1024 px.
- The app bundle references the ICNS through `CFBundleIconFile` or the build packaging equivalent.
- A monochrome menu bar template image with 1x and 2x representations, using native template rendering.

### Windows

- `32x32.png`, `128x128.png`, `128x128@2x.png`, and multi-resolution `icon.ico` at the paths already declared by `windows/tauri.conf.json`.
- A separate monochrome `icon.png` for the current Tauri tray configuration, with transparency and template-compatible rendering.
- The packaged executable and installer display the intended icon rather than a default framework icon.

### Linux

- PNG files at 16, 24, 32, 48, 64, 128, 256, and 512 px.
- The application window and desktop integration reference the branded icon where supported by the existing GTK packaging flow.

### Website

- `favicon.ico` with at least 16, 32, and 48 px representations.
- PNG favicons at 16 and 32 px.
- A 180 x 180 Apple touch icon.
- A horizontal brand lockup pairing the icon with the existing name, `Prompt Editor`.
- The website head references the favicon and touch icon, and the navigation uses the horizontal lockup without changing the product name.

## Integration Boundaries

Brand assets live in platform-owned asset directories and are referenced by existing packaging configuration. Generated intermediates and visual brainstorming files are not runtime dependencies. The website receives its own optimized copies under `website/assets`; native applications do not load website assets.

The existing functional toolbar icon system remains unchanged. The monochrome tray/menu symbol is a brand adaptation owned alongside the primary icon, not a new general-purpose UI icon.

## Validation

- Visually inspect the 1024, 128, 64, 32, and 16 px outputs on light and dark backgrounds.
- Confirm that no foreground element touches common circular or rounded-square mask boundaries.
- Confirm the document, wand, and spark remain distinguishable at 32 px.
- Confirm tray/menu variants render as a single color and remain legible at native sizes.
- Inspect the website at desktop and mobile widths for logo alignment and text fit.
- Build or inspect the macOS app bundle to verify the ICNS reference.
- Validate the ICO contains the expected embedded sizes and that all configured Tauri icon paths exist.
- Confirm Linux PNG files have the declared pixel dimensions.
- Confirm all web icon links resolve without 404 responses.

## Acceptance Criteria

The work is complete when the Prompt Forge master and all listed derivatives exist in the repository, native packaging points to the correct assets, website branding and favicon links are integrated, and size/platform validation shows no missing, blank, clipped, or illegible output.
