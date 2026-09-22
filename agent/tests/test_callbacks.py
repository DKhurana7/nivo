import asyncio
import json
from pathlib import Path
import httpx
from agent import callbacks


def test_failed_delivery_is_private_and_replay_preserves_event_id(tmp_path, monkeypatch):
    monkeypatch.setenv('AGENT_SPOOL_DIR', str(tmp_path))
    async def unavailable(payload):
        raise httpx.ConnectError('offline')
    monkeypatch.setattr(callbacks, 'deliver', unavailable)
    asyncio.run(callbacks.emit('call', 'ended', [{'role': 'user', 'text': 'Synthetic quote'}]))
    path, = tmp_path.glob('*.json')
    saved = json.loads(path.read_text())
    assert path.stat().st_mode & 0o777 == 0o600
    assert not list(tmp_path.glob('*.tmp'))
    received = []
    async def available(payload):
        received.append(json.loads(payload))
    monkeypatch.setattr(callbacks, 'deliver', available)
    asyncio.run(callbacks.replay())
    assert received[0]['id'] == saved['id']
    assert not path.exists()


def test_replay_tolerates_another_job_removing_a_listed_event(tmp_path, monkeypatch):
    monkeypatch.setenv('AGENT_SPOOL_DIR', str(tmp_path))
    path = tmp_path / 'event.json'
    path.write_text('{}')
    original = Path.read_text
    def removed(self, *args, **kwargs):
        if self == path:
            self.unlink()
        return original(self, *args, **kwargs)
    monkeypatch.setattr(Path, 'read_text', removed)
    asyncio.run(callbacks.replay())  # must not fail a new conversation
