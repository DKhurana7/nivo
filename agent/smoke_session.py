"""Live local session smoke. Uses only the ephemeral synthetic studio and generated speech."""
import asyncio
import json
import os
import time
from pathlib import Path
import httpx
from livekit import rtc
from .local_models import PiperTTS

async def main():
    login=json.loads(Path(os.environ.get('NIVO_SMOKE_LOGIN_FILE', 'data/voice-test-login.json')).read_text())
    assert login['email'] == 'voice-test@example.test' or login['email'].endswith('@audit.local'), 'Synthetic accounts only'
    async with httpx.AsyncClient(base_url='http://127.0.0.1:8787',headers={'X-Nivo-Request':'1'},timeout=60) as client:
        r=await client.post('/api/login',json={'email':login['email'],'password':login['password']});r.raise_for_status()
        status=(await client.get('/api/voice/status')).json()
        assert not status['outboundEnabled'], 'Disable outbound calling before the synthetic smoke'
        assert status['reachable'] and status['agentVerified'],status
        import uuid
        r=await client.post('/api/calls',json={'mode':'browser','enquiryId':login['enquiryId'],'requestId':str(uuid.uuid4())});r.raise_for_status();call=r.json()
        room=rtc.Room();audio_seconds=0;readers=set();source=None;speaker=None
        async def consume(track):
            nonlocal audio_seconds
            stream=rtc.AudioStream(track)
            try:
                async for event in stream:audio_seconds+=event.frame.duration
            finally:
                await stream.aclose()
        @room.on('track_subscribed')
        def subscribed(track,publication,participant):
            task=asyncio.create_task(consume(track));readers.add(task);task.add_done_callback(readers.discard)
        try:
            await room.connect(call['url'],call['token'])
            source=rtc.AudioSource(24000,1)
            track=rtc.LocalAudioTrack.create_audio_track('synthetic-vendor',source)
            await room.local_participant.publish_track(track,rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
            os.environ.setdefault('PIPER_MODEL_PATH','models/en_US-lessac-medium.onnx')
            speaker=PiperTTS()
            async def say(text):
                resampler=rtc.AudioResampler(speaker.sample_rate,24000,num_channels=1)
                async for event in speaker.synthesize(text):
                    for frame in resampler.push(event.frame):await source.capture_frame(frame)
                for frame in resampler.flush():await source.capture_frame(frame)
                # Keep publishing silence so the remote VAD can close the speech turn.
                for _ in range(150):await source.capture_frame(rtc.AudioFrame(bytes(480*2),24000,1,480))
                await source.wait_for_playout()
            async def wait_for(predicate,seconds=75):
                until=time.monotonic()+seconds
                while time.monotonic()<until:
                    result=(await client.get(f"/api/calls/{call['id']}")).json()
                    if result['status']=='failed':raise RuntimeError(result['error'])
                    if predicate(result):return result
                    await asyncio.sleep(.5)
                raise AssertionError('Timed out waiting for the voice pipeline')
            first=await wait_for(lambda c:len(c['transcript'])>=1)
            await asyncio.sleep(2)
            await say('Yes, you can transcribe the conversation. Please tell me which product you need.')
            second=await wait_for(lambda c:len([t for t in c['transcript'] if t['role']=='assistant'])>=2)
            assert any(t['role']=='user' for t in second['transcript'])
            assert audio_seconds>1, 'No agent audio received'
            await asyncio.sleep(2)
            await say('The two point five square millimetre FRLS copper cable is one hundred and twenty five rupees per metre, excluding goods and services tax. Supply only, delivery extra. The quote is valid for seven days.')
            quoted=await wait_for(lambda c:len([t for t in c['transcript'] if t['role']=='user'])>=2)
            r=await client.post(f"/api/calls/{call['id']}/extract");r.raise_for_status()
            drafts=r.json()
            assert len(drafts)==1 and drafts[0]['cost']==125 and drafts[0]['basis']=='excluding-gst',drafts
            assert drafts[0]['needsReview'] is True
            print(json.dumps({'status':'passed','transcriptTurns':len(quoted['transcript']),'receivedAudioSeconds':round(audio_seconds,1),'quotedCost':drafts[0]['cost'],'basis':drafts[0]['basis'],'needsReview':True},ensure_ascii=False))
        finally:
            await client.post(f"/api/calls/{call['id']}/end")
            if speaker:await speaker.aclose()
            if source:await source.aclose()
            await room.disconnect()
            pending=list(readers)
            for task in pending:task.cancel()
            await asyncio.gather(*pending,return_exceptions=True)

if __name__=='__main__':
    asyncio.run(main())
    # Release callback cycles and their native RTC handles before the SDK's atexit disposal.
    import gc
    gc.collect()
