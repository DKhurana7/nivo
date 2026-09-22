"""CPU model adapters for the no-paid-provider browser testing profile."""
import asyncio
import io
import os
import uuid
import wave
from livekit import rtc
from livekit.agents import stt, tts, APIConnectOptions, DEFAULT_API_CONNECT_OPTIONS, NOT_GIVEN


class WhisperSTT(stt.STT):
    def __init__(self):
        super().__init__(capabilities=stt.STTCapabilities(streaming=False, interim_results=False))
        from faster_whisper import WhisperModel
        self.model_instance = WhisperModel(os.getenv('WHISPER_MODEL', 'base'), device=os.getenv('WHISPER_DEVICE', 'cpu'), compute_type=os.getenv('WHISPER_COMPUTE_TYPE', 'int8'))
        self.language = os.getenv('WHISPER_LANGUAGE') or None
        self.lock = asyncio.Lock()

    async def _recognize_impl(self, buffer, *, language=NOT_GIVEN, conn_options: APIConnectOptions):
        frame = rtc.combine_audio_frames(buffer)
        stream = io.BytesIO()
        with wave.open(stream, 'wb') as wav:
            wav.setnchannels(frame.num_channels)
            wav.setsampwidth(2)
            wav.setframerate(frame.sample_rate)
            wav.writeframes(frame.data.tobytes())
        def recognize():
            stream.seek(0)
            segments, info = self.model_instance.transcribe(stream, language=self.language, beam_size=1, vad_filter=False)
            return ''.join(s.text for s in segments).strip(), info.language
        async with self.lock:
            text, detected = await asyncio.to_thread(recognize)
        return stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT, alternatives=[stt.SpeechData(language=detected, text=text)])


class PiperTTS(tts.TTS):
    def __init__(self):
        from piper import PiperVoice
        path = os.environ.get('PIPER_MODEL_PATH', '')
        if not path or not os.path.isfile(path):
            raise ValueError('Set PIPER_MODEL_PATH to a downloaded .onnx voice with its .onnx.json file')
        self.voice = PiperVoice.load(path)
        self.lock = asyncio.Lock()
        super().__init__(capabilities=tts.TTSCapabilities(streaming=False), sample_rate=self.voice.config.sample_rate, num_channels=1)

    def synthesize(self, text, *, conn_options=DEFAULT_API_CONNECT_OPTIONS):
        return PiperStream(tts=self, input_text=text, conn_options=conn_options)


class PiperStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter):
        output_emitter.initialize(request_id=str(uuid.uuid4()), sample_rate=self._tts.sample_rate, num_channels=1, mime_type='audio/pcm')
        # Sentence-sized synthesis is adapted by LiveKit's StreamAdapter.
        async with self._tts.lock:
            chunks = await asyncio.to_thread(lambda: [c.audio_int16_bytes for c in self._tts.voice.synthesize(self.input_text)])
        for chunk in chunks:
            output_emitter.push(chunk)
        output_emitter.flush()
