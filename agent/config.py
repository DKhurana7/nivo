"""Validated worker settings. Provider secrets never enter room metadata."""
import os
from dataclasses import dataclass


def number(name, default, low, high):
    value = float(os.getenv(name, default))
    if not low <= value <= high:
        raise ValueError(f'{name} must be between {low} and {high}')
    return value


@dataclass(frozen=True)
class Settings:
    vad_threshold: float
    speech: float
    silence: float
    padding: float
    endpoint_min: float
    endpoint_max: float
    interruption: float
    denoise: bool
    denoise_model: str
    language: str

    @classmethod
    def load(cls):
        lo = number('ENDPOINT_MIN_SECONDS', .5, .1, 3)
        hi = number('ENDPOINT_MAX_SECONDS', 3, lo, 10)
        return cls(number('VAD_THRESHOLD', .5, .1, .95), number('VAD_MIN_SPEECH', .15, .05, 1),
                   number('VAD_MIN_SILENCE', .5, .1, 2), number('VAD_PREFIX_PADDING', .3, .1, 1),
                   lo, hi, number('INTERRUPTION_SECONDS', .5, .1, 2),
                   os.getenv('DPDFNET_ENABLED', 'false').lower() == 'true',
                   os.getenv('DPDFNET_MODEL', 'dpdfnet2'), os.getenv('AGENT_LANGUAGE', 'English'))
