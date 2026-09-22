import numpy as np
import pytest
from livekit import rtc
from agent.noise import Denoiser
from agent.config import Settings
from agent.worker import instructions

class BurstyEnhancer:
    def __init__(self): self.pending=np.zeros(0,dtype=np.float32); self.calls=0
    def process(self,samples,sample_rate):
        self.pending=np.concatenate((self.pending,samples));self.calls+=1
        if self.calls%2: return np.zeros(0,dtype=np.float32)
        out=self.pending;self.pending=np.zeros(0,dtype=np.float32);return out
    def reset(self): self.pending=np.zeros(0,dtype=np.float32)

def test_denoiser_preserves_bursts_and_frame_dimensions():
    processor=Denoiser(enhancer=BurstyEnhancer());outputs=[]
    for n in range(1,5):
        frame=rtc.AudioFrame(np.full(160,n*1000,dtype=np.int16).tobytes(),16000,1,160)
        out=processor._process(frame);assert out.samples_per_channel==160;assert out.sample_rate==16000
        outputs.append(np.frombuffer(out.data,dtype=np.int16)[0])
    assert outputs[0]==0
    assert all(abs(a-b)<2 for a,b in zip(outputs[1:],[1000,2000,3000]))
    assert len(processor.pending)==160
    processor.enabled=False;assert processor._process(frame) is frame

def test_each_call_has_independent_noise_state():
    a=Denoiser(enhancer=BurstyEnhancer());b=Denoiser(enhancer=BurstyEnhancer())
    frame=rtc.AudioFrame(np.ones(160,dtype=np.int16).tobytes(),16000,1,160)
    a._process(frame);assert b.enhancer.calls==0

def test_vad_ranges_and_endpoint_order(monkeypatch):
    monkeypatch.setenv('VAD_THRESHOLD','1.2')
    with pytest.raises(ValueError):Settings.load()
    monkeypatch.setenv('VAD_THRESHOLD','.5');monkeypatch.setenv('ENDPOINT_MIN_SECONDS','2');monkeypatch.setenv('ENDPOINT_MAX_SECONDS','1')
    with pytest.raises(ValueError):Settings.load()

def test_prompt_bounds_agent_to_quote_collection():
    prompt=instructions({'items':[{'description':'FRLS wiring','quantityKind':'rate-only'}]},'English')
    assert 'never buy' in prompt and 'untrusted reference data' in prompt and 'permission' in prompt
