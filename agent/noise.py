"""Independent LiveKit adapter for DPDFNet's native-rate streaming API.

Echo established the per-call FrameProcessor integration pattern. This adapter
uses DPDFNet 0.6 native resampling and a FIFO so burst output is never truncated.
No model state is shared between calls. A short initial silence represents the
model's real look-ahead rather than passing raw audio through twice.
"""
import numpy as np
from livekit import rtc


class Denoiser(rtc.FrameProcessor[rtc.AudioFrame]):
    def __init__(self, model='dpdfnet2', enhancer=None):
        if enhancer is None:
            from dpdfnet import StreamEnhancer
            enhancer = StreamEnhancer(model=model)
        self.enhancer = enhancer
        self.pending = np.zeros(0, dtype=np.float32)
        self.rate = None
        self._enabled = True

    @property
    def enabled(self):
        return self._enabled

    @enabled.setter
    def enabled(self, value):
        if self._enabled != value:
            self.enhancer.reset()
            self.pending = np.zeros(0, dtype=np.float32)
        self._enabled = value

    def _process(self, frame):
        if not self.enabled:
            return frame
        if self.rate is not None and self.rate != frame.sample_rate:
            self.enhancer.reset()
            self.pending = np.zeros(0, dtype=np.float32)
        self.rate = frame.sample_rate
        samples = np.frombuffer(frame.data, dtype=np.int16).astype(np.float32).reshape(-1, frame.num_channels).mean(axis=1) / 32768
        enhanced = self.enhancer.process(samples, sample_rate=frame.sample_rate)
        self.pending = np.concatenate((self.pending, enhanced))
        n = frame.samples_per_channel
        available = min(n, len(self.pending))
        output = np.zeros(n, dtype=np.float32)
        output[:available] = self.pending[:available]
        self.pending = self.pending[available:]
        if len(self.pending) > self.rate:  # invalid provider timing, never silently discard a growing queue
            raise RuntimeError('DPDFNet output timing exceeded one second')
        pcm = (np.clip(output, -1, 1) * 32767).astype(np.int16)
        if frame.num_channels > 1:
            pcm = np.repeat(pcm, frame.num_channels)
        return rtc.AudioFrame(pcm.tobytes(), frame.sample_rate, frame.num_channels, n)

    def _close(self):
        self.enabled = False
