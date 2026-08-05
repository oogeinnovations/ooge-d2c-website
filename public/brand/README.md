# Ooge Innovations Private Limited — logo

Full legal-name lockup built on the existing OOGE mark. The `OOGE` wordmark is drawn as
outlined vector paths (no font needed), so it renders identically everywhere.

| File | Used by |
|---|---|
| `ooge-innovations-lockup.svg` | Site header — [`app/components/Header.tsx`](../../app/components/Header.tsx) |
| `ooge-innovations-lockup-white.svg` | Site footer (dark background) — [`app/components/Footer.tsx`](../../app/components/Footer.tsx) |

## Brand values

- Gold: `#FCCA00` (matches `--brand` in `app/styles/ooge.css`)
- Ink: `#0A0A0A` (matches `--brand-ink`)

## Rules of thumb

- **Clear space:** keep empty space around the logo equal to the height of the `O` on all sides.
- **Minimum size:** don't use the lockup below 24 mm / 90 px wide — below that the legal name
  stops being readable.
- **Don't** stretch it, recolour it, add effects, or rebuild the legal-name line in another font.

## Note on the legal-name line

`INNOVATIONS PRIVATE LIMITED` is live text, set in Inter with Helvetica/Arial as fallback, and
its width is pinned with `textLength` so the lockup stays the same width in any renderer. If a
printer asks for "text converted to outlines", open the SVG in Illustrator / Inkscape /
CorelDRAW and run Convert to Outlines.

## Need a PNG, or a gold-tile / horizontal / wordmark-only variant?

Those were removed to keep the repo lean. To rasterise a PNG from an SVG here, window size must
equal the SVG's `viewBox` and `--force-device-scale-factor` sets the multiplier:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --force-device-scale-factor=3 --window-size=834,262 --default-background-color=00000000 `
  --screenshot=ooge-innovations-lockup-2502x786.png ooge-innovations-lockup.svg
```
