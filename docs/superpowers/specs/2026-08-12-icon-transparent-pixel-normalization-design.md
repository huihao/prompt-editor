# Icon Transparent Pixel Normalization Design

## Goal

Make every fully transparent pixel in generated Prompt Forge raster icons truly colorless while preserving all visible artwork, internal translucent highlights, shadows, and antialiased edges.

## Scope

The canonical SVG artwork and its geometry remain unchanged. The fix applies to generated PNG slices used by macOS, Windows, Linux, and the website, including PNG inputs assembled into ICNS, ICO, and favicon containers.

Only pixels whose alpha channel is exactly zero are normalized. Their red, green, and blue channels are set to zero. Pixels with alpha from 1 through 255 are byte-for-byte unchanged, so rounded-corner antialiasing and intentional translucency remain smooth.

## Implementation

Add a small Swift/CoreGraphics command-line utility under `scripts/` that decodes a PNG into a known RGBA buffer, zeros all four bytes for pixels with alpha zero, and writes the PNG atomically. The existing `scripts/generate-icons.sh` invokes this utility after every PNG export and before constructing ICNS/ICO containers.

Extend the existing image inspection utility with an alpha-audit mode or add a focused companion validator. `scripts/validate-icons.sh` checks every generated transparent PNG and fails if any alpha-zero pixel retains nonzero RGB data. The check does not reject partial-alpha edge pixels.

No Pillow, ImageMagick, or new package dependency is introduced; the implementation uses the macOS Swift and ImageIO/CoreGraphics toolchain already required by icon generation.

## Validation

- A known PNG fixture with colored transparent pixels fails before normalization.
- Normalization changes only alpha-zero pixel RGB values.
- A second normalization pass produces identical output.
- `scripts/generate-icons.sh` and `scripts/validate-icons.sh` pass.
- Existing icon dimensions, ICNS/ICO representations, and macOS Universal bundle resource checks remain valid.
- A visual comparison over light, dark, and checkerboard backgrounds confirms no fringe or artwork change.

## Compatibility

The visible icon design does not change. Generated binary files may differ because hidden RGB bytes are cleaned. Existing build, signing, packaging, and platform paths remain unchanged.
