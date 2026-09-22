"""Download the local English test profile; no paid services or credentials."""
from pathlib import Path
import subprocess
import sys
from faster_whisper import WhisperModel
from dpdfnet import download
if __name__=='__main__':
    Path('models').mkdir(exist_ok=True)
    subprocess.run([sys.executable,'-m','piper.download_voices','--download-dir','models','en_US-lessac-medium'],check=True)
    WhisperModel('base',device='cpu',compute_type='int8')
    download('dpdfnet2')
    print('Local audio models are ready. Set PIPER_MODEL_PATH=models/en_US-lessac-medium.onnx. Ollama and an LLM must be installed separately.')
