"""Signed server events with durable, private retry spool. No transcript logging."""
import asyncio
import hashlib
import hmac
import json
import os
from pathlib import Path
import time
import uuid
import httpx


def headers(payload):
    secret = os.environ.get('AGENT_CALLBACK_SECRET', '')
    if len(secret) < 32:
        raise ValueError('AGENT_CALLBACK_SECRET needs at least 32 characters')
    stamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), f'{stamp}.{payload}'.encode(), hashlib.sha256).hexdigest()
    return {'X-Nivo-Timestamp': stamp, 'X-Nivo-Signature': signature}


def base_url():
    return os.environ.get('NIVO_API_URL', 'http://127.0.0.1:8787').rstrip('/')


async def get_call(call_id):
    path = f'/api/agent/calls/{call_id}'
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(base_url() + path, headers=headers(path))
        response.raise_for_status()
        return response.json()


async def deliver(payload):
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(base_url() + '/api/agent/events', json={'payload': payload}, headers=headers(payload))
        response.raise_for_status()


def spool_dir():
    path = Path(os.getenv('AGENT_SPOOL_DIR', './data/agent-spool'))
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    return path


async def emit(call_id, status, transcript):
    payload = json.dumps({'id': str(uuid.uuid4()), 'callId': call_id, 'status': status, 'transcript': list(transcript)}, ensure_ascii=False)
    path = spool_dir() / f'{uuid.uuid4()}.json'
    temporary = path.with_suffix('.tmp')
    with temporary.open('x', encoding='utf8') as handle:
        os.chmod(temporary, 0o600)
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)
    try:
        await deliver(payload)
        path.unlink(missing_ok=True)
    except (httpx.HTTPError, OSError):
        # Durable spool survives worker exit; replay command uses the same event ID.
        pass


async def replay():
    for path in spool_dir().glob('*.json'):
        try:
            await deliver(path.read_text(encoding='utf8'))
            path.unlink(missing_ok=True)
        except (httpx.HTTPError, OSError):
            # Another job or an in-flight emit may have already delivered/deleted it.
            continue


if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(replay())
