"""Renders a cover image for every article in content/articles/*.json.

Run: python scripts/make-covers.py   (needs Pillow and Google Chrome)
Each cover (and the optional mid-article photo, <slug>-2) is the article's photo (content/photos/<slug>.jpg, free Unsplash licence, credited on the
article page) cropped to 1200x630 with an "I Need Save" watermark in the top-right corner.
Writes public/artikel/img/<slug>.webp (cards) and <slug>.jpg (link previews).
"""
import glob
import json
import os
import shutil
import subprocess
import tempfile

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
W, H = 1200, 630
LOGO = ('<svg viewBox="0 0 32 32" width="34" height="34"><rect width="32" height="32" rx="9" fill="#FAFAFA"/>'
        '<path transform="translate(7 7) scale(.75)" d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" '
        'stroke="#0A0A0A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
CHROME = [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium']


def file_url(path):
    return 'file:///' + os.path.abspath(path).replace('\\', '/')


def page(photo, position):
    font = file_url(os.path.join(ROOT, 'public/fonts/noto-sans-latin.woff2'))
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Noto Sans"; font-weight: 400 700; src: url("{font}") format("woff2"); }}
html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #0A0A0A; }}
img.photo {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: {position}; }}
.badge {{ position: absolute; top: 32px; right: 36px; display: flex; align-items: center; gap: 12px;
          color: #FAFAFA; font: 700 28px/1 "Noto Sans", sans-serif; letter-spacing: -0.01em;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .55)) drop-shadow(0 2px 10px rgba(0, 0, 0, .45)); }}
</style></head><body>
<img class="photo" src="{file_url(photo)}" alt="">
<div class="badge">{LOGO}<span>I Need Save</span></div>
</body></html>"""


def render(name, position, chrome, work, out_dir, jpg=True):
    """content/photos/<name>.jpg -> public/artikel/img/<name>.webp (+ .jpg for link previews)."""
    html = os.path.join(work, f'{name}.html')
    photo = os.path.join(ROOT, 'content/photos', f'{name}.jpg')
    open(html, 'w', encoding='utf-8').write(page(photo, position))
    shot = os.path.join(work, f'{name}.png')
    subprocess.run([chrome, '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--allow-file-access-from-files', f'--window-size={W},{H}', '--virtual-time-budget=4000',
                    f'--screenshot={shot}', file_url(html)], check=True, capture_output=True)
    img = Image.open(shot).convert('RGB').resize((W, H), Image.LANCZOS)
    base = os.path.join(out_dir, name)
    img.save(base + '.webp', quality=80, method=6)
    if jpg:
        img.save(base + '.jpg', quality=82, optimize=True, progressive=True)


if __name__ == '__main__':
    chrome = next((c for c in CHROME if os.path.exists(c) or shutil.which(c)), None)
    if not chrome:
        raise SystemExit('Google Chrome not found')
    out_dir = os.path.join(ROOT, 'public/artikel/img')
    os.makedirs(out_dir, exist_ok=True)
    work = tempfile.mkdtemp()
    for path in sorted(glob.glob(os.path.join(ROOT, 'content/articles/*.json'))):
        article = json.load(open(path, encoding='utf-8'))
        slug = article['slug']
        render(slug, article.get('photo', {}).get('position', 'center'), chrome, work, out_dir)
        if article.get('photo2'):  # the photo shown in the middle of the article
            render(f'{slug}-2', article['photo2'].get('position', 'center'), chrome, work, out_dir, jpg=False)
        print('images', slug)
