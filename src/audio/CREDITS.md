# Audio sources and adaptation notes

All recordings are embedded in the standalone HTML. No network requests are
needed for playback. Licenses below apply to the audio assets, not unrelated
application code. No affiliation or endorsement by the credited sources is implied.

## Full acoustic country recording — CC BY 4.0

**Corncob by Kevin MacLeod** (incompetech.com)
Link: https://incompetech.filmmusic.io/song/3554-corncob
Licensed under Creative Commons: By Attribution 4.0 License
https://creativecommons.org/licenses/by/4.0/

This is the complete approximately 54-second recording, with acoustic banjo
picking and a drum-kit shuffle, not the previous Kenney chiptune loop. The source
MP3 explicitly embeds the title, artist, ISRC `USUAN1100565`, the description
"Bouncy country tune featuring fast banjo picking and grooving shuffle on the
drumset", and the CC BY 4.0 license URL.

Source mirror: adam-batson/garden-guardin, commit
`da57a578eb640d1306f172d047474d53076cda9e`, file
`src/assets/audio/music/corncob-by-kevin-macleod-from-filmmusic-io.mp3`:
https://github.com/adam-batson/garden-guardin/blob/da57a578eb640d1306f172d047474d53076cda9e/src/assets/audio/music/corncob-by-kevin-macleod-from-filmmusic-io.mp3
Original SHA-256: `9640aa7bd1dcedbb6862658215999046c73f1c8c33853e8afa3b74969e33dc14`.

Adaptation `menu-music.mp3`: the complete song is retained, attenuated by 6 dB
for headroom and encoded as 44.1 kHz stereo / 256 kbit/s MP3. No cut, pitch change,
bit-crushing or synthetic instrument layer is added. Attribution appears in the
game. Full license: LICENSE-CC-BY-4.0.txt.

## Human cries — Flare contributors, CC BY-SA 3.0

The new voices are human character voice recordings from the open Flare project,
not the former Red Eclipse hurt/death effects. Bandits and the boss play at
natural pitch; civilians use the boss hurt recording raised by two semitones
at playback (rate `2 ** (2 / 12)`).

Source: flareteam/flare-game, commit `af6eee6d339ac98011864bfe89da837fe7769c28`.
https://github.com/flareteam/flare-game/tree/af6eee6d339ac98011864bfe89da837fe7769c28/mods/fantasycore/soundfx

| Adaptation       | Original recording                    |
| ---------------- | ------------------------------------- |
| bandit-death.mp3 | mods/fantasycore/soundfx/male_die.ogg |
| pain.mp3         | mods/fantasycore/soundfx/male_hit.ogg |

Credit: Flare contributors and the artists listed in the unabridged original
FLARE-CREDITS.txt included alongside these files. Source licensing is the Flare
repository LICENSE.txt, copied as LICENSE-FLARE-CC-BY-SA-3.0.txt.
https://creativecommons.org/licenses/by-sa/3.0/
These audio adaptations are distributed under that same license.

Processing: mono 44.1 kHz / 128 kbit/s MP3, peak normalization, at most a few
milliseconds of padding, and a 20 ms tail fade. There is no ring modulation,
synthesized voice, or metallic body-hit layer. Bandit/civilian cries start
alongside the gun recording. Both now use `pain.mp3`: the bandit at natural
pitch and the civilian two semitones higher, both at the boss hurt volume.
Boss wounded (`pain.mp3`) and fatal (`bandit-death.mp3`, retained filename)
recordings, pitch and levels are unchanged; the latter has its own `bossDeath`
event so bandit voice changes cannot affect it.

## One fixed real revolver shot — CC0 1.0

`shot.mp3` is a real **Ruger Single Six, single-action .22** revolver recording from
**The Free Firearm Sound Library**, recorded by **Ben Jaszczak, Brian Nelson,
Kevin Heras and Matthew Nanney**.
https://opengameart.org/content/the-free-firearm-sound-library

Mirror: blkpanfa/sidekick-sounds, commit `4f3a077c12057b4f91e14803a7e3c9d564f6afaa`.
Original: `gun/revolver/ruger-single-six-near-shot1.flac` (manifest original `S_14P.wav`).
Original SHA-256, verified before conversion:
`b9db170fe8df4385a3887784e23d8358cc1bc32096224d9aa5f6752216669a27`.

Processing: 35 Hz high-pass, mono, normalization to 0.8, tail trimmed to 1.6 s,
50 ms end fade, 44.1 kHz / 192 kbit/s MP3. This is the same take for every shot,
with fixed rate, level and centered pan. The former second take is removed.
Independent gun and impact compressor buses keep an impact from ducking the gun.
All hit cues start concurrently; no impact cue replaces or stops the shot.
Full CC0 text: LICENSE-CC0-1.0.txt.

## Saloon creaks — Kenney RPG Audio, CC0 1.0

`saloon-door.mp3` layers two stereo-positioned opening creaks, offset by 0.3 s,
from Kenney RPG Audio's `creak1.ogg`. `menu-ambience.mp3` retains two quieter
creaks in its wind bed. Kenney: https://kenney.nl/ .

Mirror: violetferret/Game3, commit `af6119399400a89032d0bea568a53ec443aa44c7`,
`assets/kenney_rpg-audio/Audio/creak1.ogg`.
Original SHA-256: `8a346186fd297254248cab8e8117060a52a5cf2a84f603153a762108550ea95e`.
Pack license copied as LICENSE-KENNEY-RPG.txt.

## Remaining impacts, reload, wind — Red Eclipse, CC BY-SA 4.0

Copyright (C) 2009–2025 Red Eclipse Team. Sound-design credits include xJoJox,
Quinton "quin" Reeves, Sławek "Q009" Błauciak and garsipal. The ambience credits
name Quinton Reeves and Alex "blackshoe" Anguix.

Source commit `ec74d59ea3b88f078122d2777103b3f06275b943`:
https://github.com/redeclipse/sounds/tree/ec74d59ea3b88f078122d2777103b3f06275b943
Original readme and license breakdown:
https://github.com/redeclipse/base/blob/master/doc/all-licenses.txt
License: https://creativecommons.org/licenses/by-sa/4.0/
Full text: LICENSE-CC-BY-SA-4.0.txt.

| Adaptation               | Source                                 |
| ------------------------ | -------------------------------------- |
| reload.mp3               | weapons/pistol/reload.ogg              |
| wood-1.mp3 / wood-2.mp3  | weapons/thud.ogg / thud2.ogg           |
| menu-hover.mp3           | a filtered 90 ms excerpt of wood-1.mp3 |
| menu-ambience.mp3 (wind) | ambience/blowwind.ogg                  |

Reload is time-compressed to 1.1 s. Impacts retain a low-pass filter and wood
resonance boost; the hover tick uses a short fade and high-/low-pass filters.
The 12-second ambience combines a filtered wind excerpt (seconds 6–18) with
attenuated Kenney creaks at 2.8 and 8.3 seconds and gentle boundary fades. These
adaptations, including the combined ambience and hover tick, are CC BY-SA 4.0.
