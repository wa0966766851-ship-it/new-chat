"""Losslessly recompress development screenshots; preserve paths, dimensions and RGBA pixels.

Requires Pillow. Defaults to preview; --apply writes only verified smaller PNGs.
This intentionally excludes public assets, animation frames and browser profile data.
"""
import hashlib
import io
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
apply = '--apply' in sys.argv
folders = ['shots', '_shots', 'docs/screenshots', 'docs/audits/screenshots',
           'docs/images', 'docs/ui-verification', '.seer-cache/animation-shots',
           '.seer-cache/animation-shots-1024', '.seer-cache/remote-animation-shots',
           '.seer-cache/visual-review-20261027', '.seer-cache/player-audit-20261027']
result = {'applied': apply, 'files': [], 'savedBytes': 0, 'skipped': []}
for folder in folders:
    base = root / folder
    if not base.exists():
        continue
    if base.is_symlink():
        raise RuntimeError(f'Linked folder refused: {base}')
    for file in sorted(base.rglob('*.png')):
        if file.is_symlink() or root not in file.resolve().parents:
            raise RuntimeError(f'Unsafe path: {file}')
        original = file.read_bytes()
        with Image.open(io.BytesIO(original)) as image:
            if getattr(image, 'n_frames', 1) != 1:
                result['skipped'].append({'path': str(file.relative_to(root)), 'reason': 'animated image'})
                continue
            image.load()
            pixels = image.convert('RGBA').tobytes()
            output = io.BytesIO()
            image.save(output, format='PNG', optimize=True, compress_level=9)
            encoded = output.getvalue()
            if len(encoded) >= len(original):
                continue
            with Image.open(io.BytesIO(encoded)) as check:
                if check.size != image.size or check.convert('RGBA').tobytes() != pixels:
                    raise RuntimeError(f'Pixel mismatch: {file}')
            item = {'path': file.relative_to(root).as_posix(), 'before': len(original), 'after': len(encoded),
                    'size': image.size, 'pixelSHA256': hashlib.sha256(pixels).hexdigest()}
            if apply:
                if file.read_bytes() != original:
                    raise RuntimeError(f'File changed: {file}')
                temporary = file.with_suffix('.png.compress-tmp')
                temporary.write_bytes(encoded)
                temporary.replace(file)
            result['files'].append(item)
            result['savedBytes'] += len(original) - len(encoded)
audit = root / '.cleanup-audit'
audit.mkdir(exist_ok=True)
(audit / ('screenshots-result.json' if apply else 'screenshots-plan.json')).write_text(
    json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'applied': apply, 'optimizedFiles': len(result['files']), 'savedMiB': result['savedBytes'] / 2**20}))
