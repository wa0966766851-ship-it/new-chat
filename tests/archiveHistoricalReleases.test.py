import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import zipfile

scripts = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location('release_archiver', scripts / 'archive_historical_releases.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
original_check = module.subprocess.check_output
original_argv = sys.argv
try:
    with tempfile.TemporaryDirectory(prefix='seer-release-archive-test-') as temp:
        root = Path(temp)
        module.ROOT = root
        module.processes = lambda: ''
        module.subprocess.check_output = lambda *args, **kwargs: b''
        for folder in ['dist-electron/nsis-web', 'release', '.desktop-releases']:
            (root / folder).mkdir(parents=True)
        (root / 'package.json').write_text('{"version":"1.2.0"}')
        (root / '.desktop-releases/active.json').write_text('{}')
        files = {'dist-electron/game-1.0.0-portable.exe': b'old exe',
                 'dist-electron/game-1.0.1-portable.exe': b'unmatched exe',
                 'dist-electron/game-1.1.0-portable.exe': b'previous protected',
                 'dist-electron/game-1.2.0-portable.exe': b'current protected',
                 'dist-electron/nsis-web/game-1.0.1-x64.nsis.7z': b'old payload'}
        for name, data in files.items():
            (root / name).write_bytes(data)
        archive = root / 'dist-electron/game-1.0.0-exe.zip'
        with zipfile.ZipFile(archive, 'w') as saved:
            saved.writestr('game-1.0.0-portable.exe', b'old exe')
        old = time.time() - 48 * 3600
        for file in root.rglob('*'):
            if file.is_file():
                os.utime(file, (old, old))
        sys.argv = ['archive_historical_releases.py', '--apply']
        with contextlib.redirect_stdout(io.StringIO()):
            module.main()
        result = json.loads((root / '.cleanup-audit/release-archive-result.json').read_text(encoding='utf-8'))
        assert len(result['deduplicated']) == 1
        assert not (root / 'dist-electron/game-1.0.0-portable.exe').exists()
        record = result['deduplicated'][0]
        with zipfile.ZipFile(root / record['backupZip']) as saved:
            assert saved.read(record['member']) == b'old exe'
        for version in ['1.1.0', '1.2.0']:
            assert (root / f'dist-electron/game-{version}-portable.exe').read_bytes() == files[f'dist-electron/game-{version}-portable.exe']
        for record in result['moved']:
            if not record['path'].endswith('.zip'):
                assert (root / record['archive']).read_bytes() == files[record['path']]
finally:
    module.subprocess.check_output = original_check
    sys.argv = original_argv
print('PASS: current/previous protected; ZIP-backed duplicate removed; unmatched EXE and payload preserved')
