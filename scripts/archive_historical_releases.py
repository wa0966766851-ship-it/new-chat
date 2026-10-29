"""Keep current and previous releases in place; archive older deliverables locally.

Only remove an old EXE if a retained ZIP member has exactly the same SHA-256.
Already compressed EXE, ZIP and 7z files are moved without redundant recompression.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import time
import zipfile
from archive_workspace_artifacts import ROOT, safe_path, processes, is_running, digest_stream

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.apply and (ROOT / '.cleanup-audit/release-archive-result.json').exists():
        raise RuntimeError('This archival batch already has a receipt; do not overwrite its restore mapping')
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0'))
    current = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    candidates, versions = [], set()
    for directory in ['dist-electron', 'dist-electron/nsis-web', 'release']:
        for file in (ROOT / directory).iterdir():
            if not file.is_file():
                continue
            match = re.search(r'(?<!\d)(\d+\.\d+\.\d+)(?!\d)', file.name)
            if match:
                version = match[1]
                versions.add(version)
                candidates.append((version, file))
    older = [v for v in versions if tuple(map(int, v.split('.'))) < tuple(map(int, current.split('.')))]
    previous = max(older, key=lambda v: tuple(map(int, v.split('.')))) if older else None
    protected = {current, previous}
    candidates = [(v, f) for v, f in candidates if v not in protected and tuple(map(int, v.split('.'))) < tuple(map(int, current.split('.')))]
    active = ROOT / '.desktop-releases/active.json'
    active_bytes = active.read_bytes()
    commands = processes()
    plan = []
    for version, file in candidates:
        safe_path(ROOT, file)
        relative = file.relative_to(ROOT).as_posix()
        if relative in tracked or is_running(file, commands) or time.time() - file.stat().st_mtime < 24 * 3600:
            raise ValueError('Protected or recent release candidate: ' + relative)
        plan.append({'version': version, 'path': relative, 'bytes': file.stat().st_size,
                     'mtimeNs': file.stat().st_mtime_ns})
    result = {'applied': args.apply, 'protectedVersions': sorted(v for v in protected if v),
              'candidates': plan, 'deduplicated': [], 'moved': []}
    receipt = ROOT / '.cleanup-audit' / ('release-archive-result.json' if args.apply else 'release-archive-plan.json')
    def save():
        receipt.parent.mkdir(exist_ok=True)
        receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    print(json.dumps({'apply': args.apply, 'protectedVersions': result['protectedVersions'], 'files': len(plan), 'GiB': sum(p['bytes'] for p in plan) / 2**30}), flush=True)
    if not args.apply:
        return
    zips = [ROOT / item['path'] for item in plan if item['path'].endswith('.zip')]
    for item in plan:
        if not item['path'].endswith('.exe'):
            continue
        file = ROOT / item['path']
        source_digest = None
        matched = False
        for archive in zips:
            with zipfile.ZipFile(archive) as saved:
                for member in saved.infolist():
                    if member.file_size != item['bytes'] or member.is_dir():
                        continue
                    if source_digest is None:
                        with file.open('rb') as content:
                            source_digest = digest_stream(content)
                    with saved.open(member) as content:
                        backup_digest = digest_stream(content)
                    if source_digest != backup_digest:
                        continue
                    if active.read_bytes() != active_bytes or is_running(file, processes()):
                        raise ValueError('Release became active')
                    safe_path(ROOT, file)
                    check = file.stat()
                    if (check.st_size, check.st_mtime_ns) != (item['bytes'], item['mtimeNs']):
                        raise ValueError('Release changed before deletion')
                    # Bytes are preserved in the verified ZIP; record original and member paths.
                    file.unlink()
                    result['deduplicated'].append({**item, 'sha256': source_digest,
                        'backupZip': archive.relative_to(ROOT).as_posix(), 'member': member.filename})
                    save()
                    print(json.dumps({'deduplicated': item['path'], 'bytes': item['bytes']}), flush=True)
                    matched = True
                    break
            if matched:
                break
    removed = {item['path'] for item in result['deduplicated']}
    for item in plan:
        if item['path'] in removed:
            continue
        source = safe_path(ROOT, ROOT / item['path'])
        destination = safe_path(ROOT, ROOT / '.local-archives/20261029/releases' / item['version'] / item['path'])
        if destination.exists():
            raise ValueError('Archive destination already exists')
        if active.read_bytes() != active_bytes or is_running(source, processes()):
            raise ValueError('Release became active')
        check = source.stat()
        if (check.st_size, check.st_mtime_ns) != (item['bytes'], item['mtimeNs']):
            raise ValueError('Release changed before move')
        destination.parent.mkdir(parents=True, exist_ok=True)
        source.rename(destination)  # Same-volume rename, no lossy conversion or recompression.
        result['moved'].append({**item, 'archive': destination.relative_to(ROOT).as_posix()})
        save()
    for item in result['deduplicated']:
        version = next(p['version'] for p in plan if p['path'] == item['backupZip'])
        item['backupZip'] = (Path('.local-archives/20261029/releases') / version / item['backupZip']).as_posix()
    save()
    print(json.dumps({'moved': len(result['moved']), 'deduplicated': len(result['deduplicated']),
                      'netSavedGiB': sum(p['bytes'] for p in result['deduplicated']) / 2**30}), flush=True)

if __name__ == '__main__':
    main()
