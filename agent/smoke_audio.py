"""Exercise real local TTS -> PCM -> STT and DPDFNet. Uses a synthetic quote."""
import asyncio
import os
import time
import numpy as np
from livekit import rtc
from .local_models import PiperTTS, WhisperSTT
from .noise import Denoiser

async def main():
    os.environ.setdefault('PIPER_MODEL_PATH','models/en_US-lessac-medium.onnx')
    start=time.monotonic()
    tts=PiperTTS()
    frames=[]
    async for event in tts.synthesize('The rate is one hundred and twenty five rupees per metre, excluding tax.'):
        frames.append(event.frame)
    assert frames, 'Piper returned no audio'
    audio=rtc.combine_audio_frames(frames)
    speech=WhisperSTT()
    result=await speech.recognize(audio)
    text=result.alternatives[0].text
    assert 'rate' in text.lower() and ('rupee' in text.lower() or '125' in text), text
    denoise=Denoiser()
    out=denoise._process(audio)
    assert out.sample_rate==audio.sample_rate and out.samples_per_channel==audio.samples_per_channel
    assert np.isfinite(np.frombuffer(out.data,dtype=np.int16)).all()
    print({'audio_seconds':round(audio.duration,2),'transcript':text,'elapsed_seconds':round(time.monotonic()-start,2),'dpdfnet':'processed real model'})
    await speech.aclose();await tts.aclose();denoise._close()

if __name__=='__main__':asyncio.run(main())
