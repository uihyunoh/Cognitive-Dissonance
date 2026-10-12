"""Build the supplied portfolio subpages with inline WebP artwork and styles."""
from pathlib import Path
from lxml import etree
import base64
import html
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
REF = ROOT / 'design-reference'
media = json.loads((ROOT / 'media.json').read_text())

def image(name, label, width, height):
    data = base64.b64encode((DIST / 'assets' / f'{name}.webp').read_bytes()).decode()
    return f'<img src="data:image/webp;base64,{data}" width="{width}" height="{height}" alt="{label}">'

main = (DIST / 'index.html').read_text()
favicon = re.search(r'<link rel="icon"[^>]+>', main).group(0)
css = (DIST / 'pages.css').read_text()
back = f'<a class="return" href="./" aria-label="Return to the main page">{image("return", "RETURN", 119.85, 19.59)}</a>'

def page(title, body, script='', font_css=''):
    script_tag = f'<script>{script}</script>' if script else ''
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff"><meta name="description" content="{title} — Cognitive Dissonance">
<title>{title} — Cognitive Dissonance</title>{favicon}<style>{font_css}{css}</style></head>
<body><main class="page">{back}{body}</main>{script_tag}</body></html>'''

films = media['videos']
first_film = films[0]
first_video_hash = hashlib.sha256((DIST / first_film['src'].removeprefix('./')).read_bytes()).hexdigest()[:16]
worker = (ROOT / 'scripts' / 'media-worker.template.js').read_text()
worker = worker.replace('__VIDEO_HASH__', first_video_hash).replace('__VIDEO_PATH__', first_film['src'])
(DIST / 'media-worker.js').write_text(worker)
two_d = f'''<section class="film-gallery" aria-label="2D 작품 영상" tabindex="0">
<div class="two-d-frame"><video id="artwork-video" controls playsinline preload="auto"
width="{first_film['width']}" height="{first_film['height']}" poster="{first_film['poster']}"
src="{first_film['src']}" aria-label="{html.escape(first_film['title'])}">
<a href="{first_film['src']}">영상 파일 열기</a></video>
<p class="video-error" hidden>영상을 불러오지 못했습니다. <a href="{first_film['src']}">영상 파일 열기</a></p></div>'''
for name, label in [('previous', '이전 영상'), ('next', '다음 영상')]:
    two_d += f'<button class="gallery-arrow {name}" type="button" aria-label="{label}">{image(name, "", 72.16, 72.16)}</button>'
two_d += f'<span id="film-status" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">영상 1 / {len(films)}: {html.escape(first_film["title"])}</span></section>'
two_d += '<script id="film-list" type="application/json">' + json.dumps(films, ensure_ascii=False).replace('<', '\\u003c') + '</script>'
two_d += f'<h1 class="page-label two-d-label">{image("2d-view", "2D VIEW", 115.58, 19.59)}</h1>'
(DIST / '2d-view.html').write_text(page('2D VIEW', two_d, (DIST / 'video.js').read_text()))

photo = '''<section class="gallery" aria-label="Photo gallery" aria-roledescription="carousel">
<div class="gallery-window" tabindex="0" aria-label="사진 영역, 좌우 방향키로 이동"><div class="gallery-track">'''
photos = media['photos']
for number, item in enumerate(photos, 1):
    deferred = '' if number <= 3 else 'data-'
    priority = ' fetchpriority="high"' if number == 1 else ''
    extra_class = ' wide-gap' if number == 3 else ''
    photo += f'''<div class="photo-slide{extra_class}" role="group" aria-roledescription="slide" aria-label="사진 {number} / {len(photos)}">
<img {deferred}src="{item['src']}" {deferred}srcset="{item['srcset']}"
sizes="(max-width: 800px) and (max-aspect-ratio: 4/3) 82vw, 42vw"
width="{item['width']}" height="{item['height']}" alt="{html.escape(item['alt'])}" decoding="async" draggable="false"{priority}></div>'''
photo += '</div></div>'
for name, label in [('previous', '이전 사진'), ('next', '다음 사진')]:
    photo += f'<button class="gallery-arrow {name}" type="button" aria-label="{label}">{image(name, "", 72.16, 72.16)}</button>'
photo += f'<span id="gallery-status" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">사진 1 / {len(photos)}</span></section>'
photo += f'<h1 class="page-label photo-label">{image("photo", "PHOTO", 98.92, 19.59)}</h1>'
(DIST / 'photo.html').write_text(page('PHOTO', photo, (DIST / 'gallery.js').read_text()))

tree = etree.parse(str(REF / 'artist-14.svg'))
lines = [s.strip() for s in tree.xpath('//*[local-name()="text"]//text()') if s.strip()]
assert len(lines) == 12
essay = f'<section class="essay-frame" aria-labelledby="artist-title"><article class="essay" tabindex="0" aria-label="작가의 글"><h1 id="artist-title">{html.escape(lines[0])}</h1>'
for indices in [(1,2,3), (4,5,6), (7,8,9), (10,11)]:
    essay += '<p>'
    for i in indices:
        if i == 6:
            essay += f' <small>{html.escape(lines[i])}</small>'
        elif i == 5:
            essay += f'<span class="line">{html.escape(lines[i])}'
        else:
            essay += f'<span class="line">{html.escape(lines[i])}</span>\n'
    if 6 in indices: essay += '</span>'
    essay += '</p>'
essay += '</article></section>'
essay += f'<p class="page-label artist-label">{image("uihyun-oh", "UIHYUN OH!", 178.28, 20.08)}</p>'
font_css = ''
for face in ('BookkGothic-Lt', 'BookkGothic-Bd'):
    data = base64.b64encode((DIST / 'assets' / 'fonts' / f'{face}.woff2').read_bytes()).decode()
    font_css += f'@font-face {{ font-family: "{face}"; font-style: normal; font-weight: 400; font-display: block; src: url("data:font/woff2;base64,{data}") format("woff2"); }}\n'
(DIST / 'uihyun-oh.html').write_text(page('UIHYUN OH!', essay, font_css=font_css))

# Keep the existing main composition intact; activate its three menu links.
routes = {'view': ('2d-view.html', '2D VIEW'), 'photo': ('photo.html', 'PHOTO'), 'artist': ('uihyun-oh.html', 'UIHYUN OH!')}
for name, (route, label) in routes.items():
    pattern = rf'<button class="{name} control"[^>]*>(.*?)</button>'
    main = re.sub(pattern, lambda m: f'<a class="{name} control" href="./{route}" aria-label="{label}">{m.group(1)}</a>', main, flags=re.S)
preload_tag = '<script id="first-film-preload">' + (DIST / 'media-preload.js').read_text() + '</script>'
main = re.sub(r'<script id="first-film-preload">.*?</script>\s*', '', main, flags=re.S)
main = main.replace('</body>', preload_tag + '\n  </body>')
(DIST / 'index.html').write_text(main)
print('Built 2D VIEW, PHOTO, UIHYUN OH!, and connected the main menu.')
