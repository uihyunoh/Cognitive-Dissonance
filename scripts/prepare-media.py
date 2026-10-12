"""Prepare the supplied portfolio images and films for static delivery."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps
import argparse
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'assets' / 'media'
parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, required=True)
parser.add_argument('--uploads-dir', type=Path, required=True)
args = parser.parse_args()
OUT.mkdir(parents=True, exist_ok=True)

attached = [
    ('IMG_9560(1).jpeg', '거울로 둘러싸인 지하철과 파란 카메라 형태의 인물, 측면'),
    ('IMG_9563(1).jpeg', '지하철 안 파란 카메라 형태의 인물, 위에서 본 장면'),
    ('IMG_9562(1).jpeg', '지하철 거울 앞 파란 카메라 속 얼굴과 인물의 정면'),
]
process_alts = [
    '캐릭터 모델의 정면 작업 화면',
    '캐릭터의 뼈대와 리깅 작업 화면',
    '노란 구조물 안 캐릭터 테스트 장면',
    '캐릭터 머티리얼 노드 작업 화면',
    '도시 건축물과 도로의 3D 장면',
    '캐릭터 동작 블루프린트 작업 화면',
    '도시 공간과 카메라 뷰 작업 화면',
    '거울 앞에서 마주 보는 두 캐릭터',
    '도시 배경의 캐릭터 편집 화면',
    '지하철 내부에 서 있는 캐릭터',
    '지하철 내부의 캐릭터 효과 작업 화면',
]
inputs = [(args.uploads_dir / name, alt) for name, alt in attached]
screenshots = sorted(args.source_dir.glob('*.png'))
if len(screenshots) != len(process_alts):
    raise ValueError('Expected the eleven supplied process screenshots')
inputs += list(zip(screenshots, process_alts))
photos = []
for number, (source, alt) in enumerate(inputs, 1):
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        im.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
        stem = f'photo-{number:02}'
        full = OUT / f'{stem}.webp'
        im.save(full, 'WEBP', quality=88, method=6)
        small = im.copy()
        small.thumbnail((960, 1200), Image.Resampling.LANCZOS)
        mobile = OUT / f'{stem}-small.webp'
        small.save(mobile, 'WEBP', quality=85, method=6)
        photos.append({
            'source': source.name, 'alt': alt,
            'src': f'./assets/media/{full.name}',
            'srcset': f'./assets/media/{mobile.name} {small.width}w, ./assets/media/{full.name} {im.width}w',
            'width': im.width, 'height': im.height,
            'bytes': full.stat().st_size, 'small_bytes': mobile.stat().st_size,
        })
        print(f'{source.name}: {source.stat().st_size:,} -> {full.stat().st_size:,} bytes', flush=True)

# Keep asset filenames stable while showing the archive before chat attachments.
attachment_names = {name for name, _ in attached}
photos.sort(key=lambda item: item['source'] in attachment_names)

video_inputs = [
    ('시퀀스 02.mp4', '지하철 시퀀스'),
    ('confirm.mp4', '캐릭터 애니메이션 작업'),
    ('confirm 5.mp4', '캐릭터 동작 테스트'),
    ('confirm 7.mp4', '도시 공간 동작 테스트'),
]

def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)
    ]))

def video(task):
    number, (name, title) = task
    source = args.source_dir / name
    target = OUT / f'film-{number:02}.mp4'
    poster = OUT / f'film-{number:02}-poster.webp'
    duration = float(probe(source)['format']['duration'])
    maxrate = 2600 if duration > 60 else 4000
    subprocess.run([
        'ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(source),
        '-map', '0:v:0', '-map', '0:a?',
        '-vf', "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
        '-maxrate', f'{maxrate}k', '-bufsize', f'{maxrate * 2}k',
        '-threads', '4', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(target)
    ], check=True)
    if target.stat().st_size >= 25 * 1024 * 1024:
        raise ValueError(f'{target.name} exceeds the per-file delivery budget')
    subprocess.run([
        'ffmpeg', '-nostdin', '-y', '-v', 'error', '-ss', '1', '-i', str(target),
        '-frames:v', '1', '-vf', 'scale=1280:-1', '-quality', '86', str(poster)
    ], check=True)
    metadata = probe(target)
    stream = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
    print(f'{name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes', flush=True)
    return {
        'source': name, 'title': title, 'src': f'./assets/media/{target.name}',
        'poster': f'./assets/media/{poster.name}', 'duration': duration,
        'width': stream['width'], 'height': stream['height'], 'bytes': target.stat().st_size,
    }

with ThreadPoolExecutor(max_workers=2) as executor:
    videos = list(executor.map(video, enumerate(video_inputs, 1)))
(ROOT / 'media.json').write_text(json.dumps({'photos': photos, 'videos': videos}, ensure_ascii=False, indent=2) + '\n')
print('Prepared fourteen WebP photos and four H.264 films.', flush=True)
