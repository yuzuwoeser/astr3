# Export outline sources

The library's ASTR3 export outlines derive from the three static Regular fonts
listed in [sources.json](sources.json), pinned to one Noto repository revision.
Copyright notices and SIL OFL 1.1 accompany them in [OFL.txt](OFL.txt).
The normal build copies that license next to the generated JavaScript.

Regenerate the checked-in `src/export-font-data.ts` after `npm ci`:

```sh
node scripts/generate-export-fonts.mjs
```

This optional development command downloads only the pinned public font files.
To work offline, pass a directory containing the three named `.ttf` files:

```sh
node scripts/generate-export-fonts.mjs /path/to/font-directory
```

The generator records input SHA-256 hashes, extracts glyph advance/ink bounds
and SVG paths at 1,000 units, and updates the website's font license notices.
OpenType.js is a development-only parser; no parser or font fetch is used by
normal builds or chart exports. Outlines have their own OFL-1.1 license and
are not covered by the repository's MIT license. Exported chart documents do
not inherit the font license.

Coverage is intentionally bounded: printable ASCII, Latin-1 U+00A0–U+00FF,
built-in chart glyphs, retrograde, primes, en/em dashes and ellipsis. Runtime
code handles the monochrome variation selector without needing its own path.
