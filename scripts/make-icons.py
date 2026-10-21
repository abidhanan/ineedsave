"""Draws the raster icons from the same geometry as the navbar logo / public/favicon.svg.

Run: python scripts/make-icons.py   (needs Pillow, and Google Chrome for the link-preview image)
Writes public/apple-touch-icon.png (180x180) and public/og-image.png (1200x630 link preview:
the logo as it looks in the dark-mode navbar - white tile, dark arrow - with "I Need Save" below).
"""
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DARK = '#18181B'
# Dark-mode palette from public/style.css
DM_BG, DM_PATTERN, DM_PRIMARY, DM_ON_PRIMARY = '#0A0A0A', '#222225', '#FAFAFA', '#0A0A0A'
# The logo arrow in its 24-unit icon space (same path as the navbar SVG), stroke 2.4, placed in a
# 32-unit box at translate(7 7) scale(.75) with corner radius 9 - exactly like favicon.svg.
SEGMENTS = [((12, 4), (12, 15)), ((12, 15), (7.5, 10.5)), ((12, 15), (16.5, 10.5)), ((5, 20), (19, 20))]
CHROME_PATHS = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium',
]


def logo_svg(size, tile, arrow):
    """The favicon drawn directly in pixel units, so large renders get perfectly round caps."""
    u = size / 32
    pt = lambda p: f'{(7 + .75 * p[0]) * u:.2f} {(7 + .75 * p[1]) * u:.2f}'
    d = ''.join(f'M{pt(a)}L{pt(b)}' for a, b in SEGMENTS)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<rect width="{size}" height="{size}" rx="{9 * u:.2f}" fill="{tile}"/>'
            f'<path d="{d}" fill="none" stroke="{arrow}" stroke-width="{1.8 * u:.2f}" '
            f'stroke-linecap="round" stroke-linejoin="round"/></svg>')


def og_image(path, width=1200, height=630):
    chrome = next((c for c in CHROME_PATHS if os.path.exists(c) or shutil.which(c)), None)
    if not chrome:
        raise SystemExit('Google Chrome not found; it is needed to render og-image.png')
    font = 'file:///' + os.path.abspath(os.path.join(ROOT, 'public/fonts/noto-sans-latin.woff2')).replace('\\', '/')
    dots = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E"
            "%3Ccircle cx='12' cy='12' r='1.5' fill='%23222225'/%3E%3C/svg%3E")
    page = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Noto Sans"; font-weight: 400 700; src: url("{font}") format("woff2"); }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; }}
body {{ background: {DM_BG} url("{dots}") repeat; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 40px; font-family: "Noto Sans", sans-serif; }}
h1 {{ margin: 0; color: {DM_PRIMARY}; font-size: 92px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }}
</style></head><body>{logo_svg(220, DM_PRIMARY, DM_ON_PRIMARY)}<h1>I Need Save</h1></body></html>"""
    work = tempfile.mkdtemp()
    html = os.path.join(work, 'og.html')
    open(html, 'w', encoding='utf-8').write(page)
    shot = os.path.join(work, 'og.png')
    # 2x device pixels, then downscale, for clean antialiasing of the logo and text.
    subprocess.run([chrome, '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--allow-file-access-from-files', f'--window-size={width},{height}',
                    '--virtual-time-budget=3000', f'--screenshot={shot}', 'file:///' + html.replace('\\', '/')],
                   check=True, capture_output=True)
    Image.open(shot).convert('RGB').resize((width, height), Image.LANCZOS).save(os.path.join(ROOT, path), optimize=True)


def apple_touch_icon(path, size=180):
    """Full-bleed square (iOS rounds the corners itself); drawn with Pillow at 4x."""
    ss = 4
    img = Image.new('RGB', (size * ss, size * ss), DARK)
    draw = ImageDraw.Draw(img)
    u = size * ss / 32
    width = 1.8 * u
    pt = lambda p: ((7 + .75 * p[0]) * u, (7 + .75 * p[1]) * u)
    for a, b in SEGMENTS:
        draw.line([pt(a), pt(b)], fill='#FFFFFF', width=round(width))
    for p in {p for seg in SEGMENTS for p in seg}:
        cx, cy = pt(p)
        draw.ellipse([cx - width / 2, cy - width / 2, cx + width / 2, cy + width / 2], fill='#FFFFFF')
    img.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, path), optimize=True)


# Favicon per device theme: light theme -> dark tile with a white arrow; dark theme -> white tile with a
# dark arrow (like the navbar logo). Pages link both with media="(prefers-color-scheme: ...)".
FAVICON_THEMES = {'light': (DARK, '#FFFFFF'), 'dark': ('#FAFAFA', '#0A0A0A')}


def favicon_svg(path, tile, arrow):
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
           f'<rect width="32" height="32" rx="9" fill="{tile}"/>'
           '<path transform="translate(7 7) scale(.75)" d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" '
           f'stroke="{arrow}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>\n')
    open(os.path.join(ROOT, path), 'w', encoding='utf-8').write(svg)


def favicon_png(path, tile, arrow, size=48):
    """Rounded tile on a transparent background, for browsers without SVG favicons; drawn at 8x."""
    ss = 8
    big = size * ss
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    u = big / 32
    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=9 * u, fill=tile)
    width = 1.8 * u
    pt = lambda p: ((7 + .75 * p[0]) * u, (7 + .75 * p[1]) * u)
    for a, b in SEGMENTS:
        draw.line([pt(a), pt(b)], fill=arrow, width=round(width))
    for p in {p for seg in SEGMENTS for p in seg}:
        cx, cy = pt(p)
        draw.ellipse([cx - width / 2, cy - width / 2, cx + width / 2, cy + width / 2], fill=arrow)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, path), optimize=True)


def favicons():
    for theme, (tile, arrow) in FAVICON_THEMES.items():
        favicon_svg(f'public/favicon-{theme}.svg', tile, arrow)
        favicon_png(f'public/favicon-{theme}.png', tile, arrow)


if __name__ == '__main__':
    apple_touch_icon('public/apple-touch-icon.png')
    og_image('public/og-image.png')
    favicons()
    print('wrote apple-touch-icon.png, og-image.png and favicon-light/dark (.svg, .png)')
