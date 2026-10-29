"""Synthetic backup/restore and deletion-boundary checks; no real project data."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import time
import zipfile

spec = importlib.util.spec_from_file_location('archiver', Path(__file__).resolve().parents[1] / 'scripts/archive_workspace_artifacts.py')
archiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archiver)
archiver.processes = lambda: ''

with tempfile.TemporaryDirectory(prefix='seer-archive-test-') as temp:
    root = Path(temp)
    source = root / 'build/old-experiment'
    source.mkdir(parents=True)
    (source / 'empty').mkdir()
    content = b'original fixture content\n' * 10000
    file = source / 'fixture.txt'
    file.write_bytes(content)
    old = time.time_ns() - 48 * 3600 * 10**9
    os.utime(file, ns=(old, old))
    active = root / 'active.json'
    active.write_text('{}')
    archive = root / '.local-archives/test/sample.zip'
    result = archiver.archive_target(root, source, archive, set(), active, b'{}')
    assert result['verified'] and result['originalRemoved']
    assert archive.is_file() and not source.exists()
    assert result['archiveBytes'] < len(content)
    manifest = archiver.verify_archive(archive)
    assert manifest['files'][0]['path'] == 'build/old-experiment/fixture.txt'
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        archiver.restore(root, archive)
    restored = Path(json.loads(output.getvalue())['restoredTo'])
    assert (restored / 'build/old-experiment/fixture.txt').read_bytes() == content
    assert (restored / 'build/old-experiment/empty').is_dir()
    source.mkdir()
    (source / 'fixture.txt').write_bytes(content)
    os.utime(source / 'fixture.txt', ns=(old, old))
    recovered = archiver.recover_completed(root, source, archive, set(), active, b'{}')
    assert recovered['recovered'] and not source.exists()
    source.mkdir()
    (source / 'fixture.txt').write_bytes(b'changed after interruption')
    try:
        archiver.recover_completed(root, source, archive, set(), active, b'{}')
        raise AssertionError('changed recovery source accepted')
    except ValueError:
        assert (source / 'fixture.txt').read_bytes() == b'changed after interruption'
    try:
        archiver.safe_path(root, root / 'build/../../outside')
        raise AssertionError('outside path accepted')
    except ValueError:
        pass
    try:
        archiver.snapshot(root, restored, {next(restored.rglob('fixture.txt')).relative_to(root).as_posix()})
        raise AssertionError('tracked file accepted')
    except ValueError:
        pass
    corrupt = root / '.local-archives/test/corrupt.zip'
    with zipfile.ZipFile(archive) as original, zipfile.ZipFile(corrupt, 'w') as damaged:
        for name in original.namelist():
            data = original.read(name)
            if name != archiver.MANIFEST:
                data = b'x' * len(data)
            damaged.writestr(name, data)
    try:
        archiver.verify_archive(corrupt)
        raise AssertionError('damaged content accepted')
    except ValueError:
        pass
print('PASS: backup, restore, guarded interruption recovery, path/tracked guards and corruption rejection')
