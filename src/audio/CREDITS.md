# Recorded sound effects

The nine MP3 files in this directory are adaptations of Red Eclipse sound effects.

Copyright (C) 2009–2025 Red Eclipse Team. Sound design contributors credited by
Red Eclipse include xJoJox, Quinton "quin" Reeves, Sławek "Q009" Błauciak and garsipal.
No endorsement or affiliation is implied.

License for these recordings and our audio adaptations: **Creative Commons
Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
https://creativecommons.org/licenses/by-sa/4.0/
The full license is included in LICENSE-CC-BY-SA-4.0.txt.
This notice applies to the audio recordings, not to unrelated application code.

Original repository: https://github.com/redeclipse/sounds
Pinned source commit: ec74d59ea3b88f078122d2777103b3f06275b943
Original license and credits:
https://github.com/redeclipse/sounds/blob/ec74d59ea3b88f078122d2777103b3f06275b943/readme.txt
License breakdown: https://github.com/redeclipse/base/blob/master/doc/all-licenses.txt

| Adapted file | Original path in redeclipse/sounds |
| --- | --- |
| shot-1.mp3 | weapons/pistol/primary.ogg |
| shot-2.mp3 | weapons/pistol/primary2.ogg |
| reload.mp3 | weapons/pistol/reload.ogg |
| wood-1.mp3 | weapons/thud.ogg |
| wood-2.mp3 | weapons/thud2.ogg |
| body.mp3 | weapons/thwack.ogg |
| pain-1.mp3 | player/pain.ogg |
| pain-2.mp3 | player/pain2.ogg |
| pain-3.mp3 | player/pain3.ogg |

Changes: mono conversion and resampling to 32 kHz; peak normalization; short
fade-outs and trimming/padding; MP3 encoding at 96 kbit/s. Pistol shots have
high-/low-pass filtering; wood thuds have a 380 Hz resonance boost and low-pass
filtering; the body impact has low-pass filtering; voices have high-pass
filtering. Reload is time-compressed to 1.1 seconds to match gameplay. Playback
adds small pitch variations (except reload), panning, and a shared limiter.
All files are embedded as data URLs in the standalone HTML; no external audio
service or download is required at runtime.
