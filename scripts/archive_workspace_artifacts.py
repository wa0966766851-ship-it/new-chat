"""Bounded local archival: ZIP, verify every byte, recheck source, then remove.

Default is a plan. --apply executes it. Archives never enter Git.
Only old isolated browser profiles and four named historical experiments are eligible.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENTS = ['exe-size-research-20261003-qVahwC', 'electron-lite-20261004',
               'site-ci-full-20261004', 'site-ci-verified-20261004']
MANIFEST = '_archive/manifest.json'

def safe_path(root, target):
    root, target = Path(root).resolve(), Path(os.path.abspath(target))
    if target == root or root not in target.parents:
        raise ValueError('Path outside the intended workspace')
    current = target
    while current != root:
        if current.exists():
            value = current.lstat()
            if stat.S_ISLNK(value.st_mode) or getattr(value, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Linked or reparse path refused: ' + str(current))
        current = current.parent
    return target

def snapshot(root, target, tracked):
    target = safe_path(root, target)
    files, directories = [], []
    for folder, dirs, names in os.walk(target, followlinks=False):
        if '.git' in dirs or '.git' in names:
            raise ValueError('Nested Git workspace refused')
        for name in dirs:
            child = Path(folder) / name
            info = child.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Linked directory refused')
            directories.append(child.relative_to(root).as_posix())
        for name in sorted(names):
            child = Path(folder) / name
            info = child.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Linked file refused')
            if not stat.S_ISREG(info.st_mode):
                raise ValueError('Nonregular file refused')
            relative = child.relative_to(root).as_posix()
            if relative in tracked:
                raise ValueError('Tracked source refused: ' + relative)
            files.append({'path': relative, 'bytes': info.st_size, 'mtimeNs': info.st_mtime_ns})
    return sorted(files, key=lambda value: value['path']), sorted(directories)

def processes():
    if os.name != 'nt':
        raise RuntimeError('Windows process checks are required')
    command = "[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress"
    return subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', command],
                                   creationflags=0x08000000).decode('utf-8-sig').casefold().replace('\\\\', '\\')

def is_running(target, commands):
    return str(target).casefold() in commands or target.as_posix().casefold() in commands

def digest_stream(stream):
    digest = hashlib.sha256()
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)
    return digest.hexdigest()

def verify_archive(archive):
    with zipfile.ZipFile(archive) as saved:
        manifest = json.loads(saved.read(MANIFEST))
        expected = {item['path']: item for item in manifest['files']}
        if len(expected) != len(manifest['files']):
            raise ValueError('Duplicate manifest paths')
        names = saved.namelist()
        if len(set(names)) != len(names) or set(names) != set(expected) | {MANIFEST}:
            raise ValueError('Archive file set mismatch')
        for name, item in expected.items():
            if name.startswith(('/', '\\')) or '..' in Path(name).parts or ':' in name:
                raise ValueError('Unsafe archive member')
            if saved.getinfo(name).file_size != item['bytes']:
                raise ValueError('Archive length mismatch')
            with saved.open(name) as content:
                if digest_stream(content) != item['sha256']:
                    raise ValueError('Archive content mismatch: ' + name)
    return manifest

def archive_target(root, target, destination, tracked, active_file, active_bytes):
    files, directories = snapshot(root, target, tracked)
    destination = safe_path(root, destination)
    if destination.exists() or destination.with_suffix('.zip.partial').exists():
        raise ValueError('Archive already exists; do not overwrite')
    if active_file.read_bytes() != active_bytes or is_running(target, processes()):
        raise ValueError('Desktop changed or source is running')
    if time.time_ns() - max((item['mtimeNs'] for item in files), default=0) < 24 * 3600 * 10**9:
        raise ValueError('Source modified within 24 hours')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.zip.partial')
    manifest = {'schemaVersion': 1, 'source': target.relative_to(root).as_posix(),
                'files': [], 'directories': directories, 'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    last_progress = time.monotonic()
    with zipfile.ZipFile(temporary, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1, allowZip64=True) as saved:
        for index, item in enumerate(files):
            source = root / item['path']
            before = source.stat()
            if (before.st_size, before.st_mtime_ns) != (item['bytes'], item['mtimeNs']):
                raise ValueError('Source changed before compression')
            digest = hashlib.sha256()
            with source.open('rb') as incoming, saved.open(item['path'], 'w', force_zip64=True) as outgoing:
                while chunk := incoming.read(1024 * 1024):
                    digest.update(chunk)
                    outgoing.write(chunk)
            manifest['files'].append({**item, 'sha256': digest.hexdigest()})
            if time.monotonic() - last_progress > 20:
                print(json.dumps({'phase': 'compress', 'source': manifest['source'], 'files': index + 1, 'totalFiles': len(files)}), flush=True)
                last_progress = time.monotonic()
        saved.writestr(MANIFEST, json.dumps(manifest, ensure_ascii=False))
    verified = verify_archive(temporary)
    if snapshot(root, target, tracked) != (files, directories):
        raise ValueError('Source changed while archiving; original retained')
    if active_file.read_bytes() != active_bytes or is_running(target, processes()):
        raise ValueError('Source became active; original retained')
    temporary.rename(destination)
    # The source has been checked against a verified complete backup immediately before removal.
    safe_path(root, target)
    shutil.rmtree(target)
    return {'source': verified['source'], 'archive': destination.relative_to(root).as_posix(),
            'sourceBytes': sum(item['bytes'] for item in files), 'archiveBytes': destination.stat().st_size,
            'files': len(files), 'verified': True, 'originalRemoved': True}

def restore(root, archive):
    archive = safe_path(root, archive)
    if Path('.local-archives') not in archive.relative_to(root).parents:
        raise ValueError('Restore accepts only local archives')
    manifest = verify_archive(archive)
    output = safe_path(root, root / 'build' / 'restored' / (archive.stem + '-' + str(time.time_ns())))
    output.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(archive) as saved:
        for directory in manifest['directories']:
            safe_path(output, output / directory).mkdir(parents=True, exist_ok=True)
        for item in manifest['files']:
            target = safe_path(output, output / item['path'])
            target.parent.mkdir(parents=True, exist_ok=True)
            with saved.open(item['path']) as incoming, target.open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
            os.utime(target, ns=(item['mtimeNs'], item['mtimeNs']))
    print(json.dumps({'restoredTo': str(output), 'files': len(manifest['files'])}), flush=True)

def recover_completed(root, source, archive, tracked, active_file, active_bytes):
    """Reconcile interruption after a verified ZIP was committed, including partial removal."""
    source, archive = safe_path(root, source), safe_path(root, archive)
    manifest = verify_archive(archive)
    if manifest['source'] != source.relative_to(root).as_posix():
        raise ValueError('Recovery source mismatch')
    if source.exists():
        files, _ = snapshot(root, source, tracked)
        expected = {item['path']: item for item in manifest['files']}
        for item in files:
            saved = expected.get(item['path'])
            if saved is None or (item['bytes'], item['mtimeNs']) != (saved['bytes'], saved['mtimeNs']):
                raise ValueError('Recovery source changed; retain original and backup')
            with (root / item['path']).open('rb') as content:
                if digest_stream(content) != saved['sha256']:
                    raise ValueError('Recovery source bytes changed')
        if active_file.read_bytes() != active_bytes or is_running(source, processes()):
            raise ValueError('Recovery source became active')
        safe_path(root, source)
        shutil.rmtree(source)
    return {'source': manifest['source'], 'archive': archive.relative_to(root).as_posix(),
            'sourceBytes': sum(item['bytes'] for item in manifest['files']), 'archiveBytes': archive.stat().st_size,
            'files': len(manifest['files']), 'verified': True, 'originalRemoved': True, 'recovered': True}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--workers', type=int, choices=[1, 2], default=1)
    parser.add_argument('--restore')
    args = parser.parse_args()
    if args.restore:
        restore(ROOT, ROOT / args.restore)
        return
    if args.resume and not args.apply:
        raise ValueError('--resume requires --apply')
    if args.apply and not args.resume and (ROOT / '.cleanup-audit/archive-result.json').exists():
        raise RuntimeError('This archival batch already has a receipt; preserve it and inspect before starting another batch')
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0'))
    active_file = ROOT / '.desktop-releases/active.json'
    active_bytes = active_file.read_bytes()
    commands = processes()
    targets = []
    for target in (ROOT / '.seer-cache').iterdir():
        if re.fullmatch(r'(diag-[\w-]+|[\w-]+-browser)', target.name) and (target / 'Local State').is_file() and (target / 'Default').is_dir():
            targets.append(('browser-profiles', target))
    targets += [('experiments', ROOT / 'build' / name) for name in EXPERIMENTS if (ROOT / 'build' / name).is_dir()]
    report = {'applied': args.apply, 'protectedDesktop': json.loads(active_bytes), 'candidates': [], 'skipped': [], 'completed': [], 'errors': []}
    receipt = ROOT / '.cleanup-audit' / ('archive-result.json' if args.apply else 'archive-plan.json')
    previous = json.loads(receipt.read_text(encoding='utf-8')) if args.resume else None
    if previous:
        if previous['protectedDesktop'] != report['protectedDesktop']:
            raise ValueError('Protected desktop changed; stop before resuming')
        report = previous
        report['errors'] = []
        finished = {item['source'] for item in report['completed']}
        for item in report['candidates']:
            if item['source'] in finished:
                continue
            source = ROOT / item['source']
            archive = ROOT / '.local-archives/20261029' / item['category'] / (source.name + '.zip')
            if archive.exists():
                report['completed'].append(recover_completed(ROOT, source, archive, tracked, active_file, active_bytes))
                receipt.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            elif archive.with_suffix('.zip.partial').exists():
                # A partial ZIP is only written before source removal; the complete source must still exist.
                if not source.is_dir():
                    raise ValueError('Partial archive without original; preserve for investigation')
                snapshot(ROOT, source, tracked)
                safe_path(ROOT, archive.with_suffix('.zip.partial')).unlink()
    for category, target in targets:
        try:
            if is_running(target, commands):
                raise ValueError('Running process uses this source')
            files, _ = snapshot(ROOT, target, tracked)
            if not files:
                continue
            if time.time_ns() - max(item['mtimeNs'] for item in files) < 24 * 3600 * 10**9:
                raise ValueError('Modified within 24 hours')
            item = {'category': category, 'source': target.relative_to(ROOT).as_posix(), 'bytes': sum(item['bytes'] for item in files), 'files': len(files)}
            if not previous:
                report['candidates'].append(item)
        except Exception as error:
            report['skipped'].append({'source': target.relative_to(ROOT).as_posix(), 'reason': str(error)})
    receipt.parent.mkdir(exist_ok=True)
    receipt.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'apply': args.apply, 'candidates': len(report['candidates']), 'GiB': sum(item['bytes'] for item in report['candidates']) / 2**30, 'skipped': len(report['skipped'])}), flush=True)
    if args.apply:
        finished = {item['source'] for item in report['completed']}
        def run_item(item):
            target = ROOT / item['source']
            destination = ROOT / '.local-archives/20261029' / item['category'] / (target.name + '.zip')
            return archive_target(ROOT, target, destination, tracked, active_file, active_bytes)
        with ThreadPoolExecutor(max_workers=args.workers) as workers:
            pending = {workers.submit(run_item, item): item for item in report['candidates'] if item['source'] not in finished}
            for future in as_completed(pending):
                item = pending[future]
                try:
                    result = future.result()
                    report['completed'].append(result)
                    print(json.dumps(result), flush=True)
                except Exception as error:
                    report['errors'].append({'source': item['source'], 'reason': str(error)})
                    print(json.dumps(report['errors'][-1]), flush=True)
                receipt.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'completed': len(report['completed']), 'errors': len(report['errors']), 'netSavedGiB': sum(item['sourceBytes'] - item['archiveBytes'] for item in report['completed']) / 2**30}), flush=True)

if __name__ == '__main__':
    main()
