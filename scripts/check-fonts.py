#!/usr/bin/env python3
"""
Audit the fonts a running DriveMist storefront actually serves for Lithuanian,
Latvian and Polish coverage.

Coverage alone is not enough, so this checks three things per font file:
  1. every required codepoint is in the cmap
  2. the glyph behind it really draws something (not an empty slot)
  3. Latvian ģ ķ ļ ņ use a comma below, not the cedilla the font uses for ç

Usage:
    pip install fonttools brotli
    python3 scripts/check-fonts.py [url]          # default http://127.0.0.1:9292

Run it against the dev server after changing any font in Theme settings › Typography.
"""
import io
import re
import sys
import urllib.request
from urllib.parse import urljoin

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools is missing. Run:  pip install fonttools brotli")

LANGS = {
    "Lithuanian": "ąĄčČęĘėĖįĮšŠųŲūŪžŽ",
    "Latvian": "āĀčČēĒģĢīĪķĶļĻņŅšŠūŪžŽ",
    "Polish": "ąĄćĆęĘłŁńŃóÓśŚźŹżŻ",
}
COMMA_BELOW = "ĢģĶķĻļŅņ"


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def cmap_of(font):
    table = {}
    for sub in font["cmap"].tables:
        table.update(sub.cmap)
    return table


def draws_something(font, name):
    if name == ".notdef":
        return False
    try:
        advance = font["hmtx"][name][0]
    except Exception:
        return False
    if "glyf" in font:
        return font["glyf"][name].numberOfContours != 0 or advance > 0
    return advance > 0


def trailing_component(font, cmap, ch):
    if "glyf" not in font or ord(ch) not in cmap:
        return None
    glyph = font["glyf"][cmap[ord(ch)]]
    if not glyph.isComposite():
        return None
    parts = [c.glyphName for c in glyph.components]
    return parts[-1] if len(parts) > 1 else None


def audit(name, blob):
    font = TTFont(io.BytesIO(blob), lazy=False)
    cmap = cmap_of(font)
    problems = []

    for lang, chars in LANGS.items():
        missing = [c for c in chars if ord(c) not in cmap]
        hollow = [c for c in chars if ord(c) in cmap and not draws_something(font, cmap[ord(c)])]
        if missing:
            problems.append(f"{lang}: no glyph for {' '.join(missing)}")
        if hollow:
            problems.append(f"{lang}: empty glyph for {' '.join(hollow)}")

    cedilla = trailing_component(font, cmap, "ç")
    if cedilla:
        wrong = [c for c in COMMA_BELOW if trailing_component(font, cmap, c) == cedilla]
        if wrong:
            problems.append(f"Latvian: {' '.join(wrong)} drawn with a cedilla, not a comma below")

    print(f"{'FAIL' if problems else 'PASS'}  {name}  ({len(cmap)} glyphs)")
    for p in problems:
        print(f"        {p}")
    return not problems


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:9292"
    try:
        html = fetch(base).decode("utf-8", "replace")
    except Exception as exc:
        sys.exit(f"Could not reach {base} — is `npm run dev` running?\n  {exc}")

    urls = sorted(set(re.findall(r'url\("([^"]+\.woff2)"\)', html)))
    if not urls:
        sys.exit("No woff2 @font-face rules found on that page.")

    print(f"Checking {len(urls)} font files served by {base}\n")
    ok = True
    for u in urls:
        name = u.rsplit("/", 1)[-1].split(".")[0]
        ok &= audit(name, fetch(urljoin(base, u)))

    print()
    if ok:
        print("All fonts cover Lithuanian, Latvian and Polish.")
    else:
        print("Some fonts are not safe for these languages — pick a different one in")
        print("Theme settings › Typography. Inter, Playfair Display, Lora, EB Garamond,")
        print("Source Serif 4 and PT Serif all have solid Baltic coverage.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
