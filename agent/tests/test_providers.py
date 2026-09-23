"""Exercise first-import registration in a fresh process, as a real worker job does."""
import os
import subprocess
import sys


def test_deepgram_providers_initialize_off_event_loop():
    result = subprocess.run(
        [sys.executable, '-c', '''
import asyncio
from agent.worker import build_providers
from livekit.plugins import deepgram

async def main():
    stt, llm, tts = await asyncio.to_thread(build_providers)
    assert isinstance(stt, deepgram.STT)
    assert isinstance(tts, deepgram.TTSv2)
    await stt.aclose()
    await llm.aclose()
    await tts.aclose()

asyncio.run(main())
'''],
        env={**os.environ, 'STT_PROVIDER': 'deepgram', 'TTS_PROVIDER': 'deepgram',
             'DEEPGRAM_API_KEY': 'synthetic-no-network', 'DEEPGRAM_TTS_MODEL': 'flux-meena-en',
             'LLM_API_KEY': 'local', 'LLM_BASE_URL': 'http://127.0.0.1:1/v1'},
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
