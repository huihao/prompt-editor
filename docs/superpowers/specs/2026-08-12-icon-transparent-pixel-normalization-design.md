# Icon Transparent Pixel Normalization Design

## Goal

Make the area outside the Prompt Forge icon's rounded silhouette fully transparent while preserving internal translucent highlights, shadows, and antialiased edges.

## Scope

The canonical SVG currently draws the translucent `shine` path after the rounded background without a clip. That path reaches the canvas corners and makes pixels outside the intended rounded silhouette partially opaque. The fix applies a shared rounded-rectangle clip to all visible artwork.

Pixels outside the silhouette must have alpha zero. Boundary pixels may retain partial alpha for smooth antialiasing, and translucency inside the silhouette remains unchanged.

## Implementation

Add an SVG `clipPath` matching the existing `1024x1024` rounded rectangle and wrap all visible layers in the clipped group. Existing deterministic generation then propagates the correction to macOS, Windows, Linux, and website assets.

Extend the existing image inspection utility with a transparent-corner audit. `scripts/validate-icons.sh` checks representative generated PNGs and fails if any canvas corner has nonzero alpha.

No Pillow, ImageMagick, or new package dependency is introduced; validation uses the macOS Swift and ImageIO/CoreGraphics toolchain already required by icon generation.

## Validation

- The current generated master fails the transparent-corner audit before the SVG clip is added.
- All four corner pixels have alpha zero after regeneration.
- `scripts/generate-icons.sh` and `scripts/validate-icons.sh` pass.
- Existing icon dimensions, ICNS/ICO representations, and macOS Universal bundle resource checks remain valid.
- A visual comparison over light, dark, and checkerboard backgrounds confirms no fringe or artwork change.

## Compatibility

The intended visible icon design does not change; only unintended translucent paint outside the rounded silhouette is removed. Existing build, signing, packaging, and platform paths remain unchanged.
