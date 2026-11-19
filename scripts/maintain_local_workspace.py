"""Plan or archive explicitly bounded old local backups and generated web builds.

Archives contain per-file SHA-256 and are read back before originals are removed.
Never removes source, player storage, active desktop releases or animation caches.
"""
import argparse
import json
from pathlib import Path
import subprocess
import time
from archive_workspace_artifacts import ROOT, snapshot, processes, is_running, archive_target, restore, recover_completed

def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--apply', action='store_true')
    cli.add_argument('--restore')
    cli.add_argument('--only', action='append', default=[], help='Restrict to named eligible directories; repeat for multiple directories')
    args = cli.parse_args()
    if args.restore:
        restore(ROOT, ROOT / args.restore)
        return
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0'))
    commands = processes()
    active_file = ROOT / '.desktop-releases/active.json'
    active_bytes = active_file.read_bytes()
    # Fixed maintenance batch. Running or recently changed directories are refused.
    names = ['_backup', '_backup_ui', '_修正前備份', '_備份_20250927_還債前', '.tmp-testlogs', 'build/custom-animation-backups',
             'build/electron-compat', 'build/electron-runtime-44.5.1']
    names += ['build/' + p.name for p in (ROOT / 'build').iterdir()
              if p.is_dir() and (p.name == 'web-package' or p.name.startswith('web-package-'))]
    if args.only:
        if not set(args.only).issubset(names):
            raise ValueError('Requested directory is outside the fixed maintenance scope')
        names = args.only
    destination = ROOT / '.local-archives/maintenance-20261117'
    receipt = ROOT / '.cleanup-audit/maintenance-20261117-result.json'
    previous = json.loads(receipt.read_text(encoding='utf-8')) if receipt.exists() else {'completed': []}
    completed = {e['source'] for e in previous['completed']}
    report = {'apply': args.apply, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'completed': previous['completed'], 'planned': [], 'skipped': []}
    for relative in sorted(set(names)):
        target = ROOT / relative
        if not target.exists() or relative in completed:
            continue
        try:
            archive = destination / (relative.replace('/', '__') + '.zip')
            if archive.with_name(archive.name + '.partial').exists():
                raise ValueError('Incomplete archive retained; source preserved. Inspect partial before retrying')
            files, _ = snapshot(ROOT, target, tracked)
            if not files:
                continue
            if is_running(target, commands):
                raise ValueError('Running process uses directory')
            if time.time_ns() - max(f['mtimeNs'] for f in files) < 24 * 3600 * 10**9:
                raise ValueError('Modified within 24 hours')
            report['planned'].append({'source': relative, 'bytes': sum(f['bytes'] for f in files), 'files': len(files)})
        except (ValueError, OSError) as error:
            report['skipped'].append({'source': relative, 'reason': str(error)})
    print(json.dumps({'apply': args.apply, 'planned': report['planned'], 'skipped': report['skipped']}, ensure_ascii=False), flush=True)
    if not args.apply:
        (ROOT / '.cleanup-audit/maintenance-20261117-plan.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        return
    for item in report['planned']:
        relative = item['source']
        archive = destination / (relative.replace('/', '__') + '.zip')
        target = ROOT / relative
        if archive.exists():
            result = recover_completed(ROOT, target, archive, tracked, active_file, active_bytes)
        else:
            result = archive_target(ROOT, target, archive, tracked, active_file, active_bytes)
        report['completed'].append(result)
        receipt.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(result, ensure_ascii=False), flush=True)
    print(json.dumps({'verifiedArchives': len(report['completed']), 'netSavedBytes': sum(e['sourceBytes'] - e['archiveBytes'] for e in report['completed'])}), flush=True)

if __name__ == '__main__':
    main()
