# Audio sources and adaptation notes

All recordings are embedded in the standalone HTML. No network requests are
needed for playback. Licenses below apply to the audio assets, not unrelated
application code. No affiliation or endorsement by the credited sources is implied.

## Slow, dark music for the menu and workshop — CC BY 4.0

Both complete recordings are by **Kevin MacLeod** (incompetech.com), licensed
under Creative Commons: By Attribution 4.0:
https://creativecommons.org/licenses/by/4.0/
Full license: LICENSE-CC-BY-4.0.txt. Attribution also appears inside the game.

### Main menu: Anguish

Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400047
A slow, somber guitar/harp/percussion piece, catalog tempo 54 BPM. The complete
239-second recording replaces the former bright banjo song Corncob.

Mirror: Sayshal/minstrel-packs-music-01, commit
`ce4e1d1a517101aed56ea47d9f795a5be1d251cd`, `assets/audio/anguish.ogg`:
https://github.com/Sayshal/minstrel-packs-music-01/blob/ce4e1d1a517101aed56ea47d9f795a5be1d251cd/assets/audio/anguish.ogg
Original SHA-256: `bfdd9a912aac073ae42e6c6c0d5e934b2a0cea33fdefcbd87d6d95a34e31dc3c`.
The source pack LICENSE explicitly licenses its music under CC BY 4.0;
its unabridged attribution file is included as MUSIC-SOURCE-ATTRIBUTION.txt
(only Anguish from that pack is used here).

### Arsenal: Southern Gothic (slow workshop edit)

Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2300004
A dark country/folk recording with banjos, 12-string guitar, choir and percussion.
The source MP3 tags identify Kevin MacLeod, title Southern Gothic, 126 BPM,
year 2023 and ISRC USUAN2300004. The full 147-second recording is slowed with
pitch-preserving `atempo=0.66666667`: 84 BPM, approximately 221 seconds.

Mirror: noobsandnerdsgroup/audio, commit
`24a545705ba6277d03c2c2d736048a72ff12d681`, `Southern Gothic.mp3`:
https://github.com/noobsandnerdsgroup/audio/blob/24a545705ba6277d03c2c2d736048a72ff12d681/Southern%20Gothic.mp3
Original SHA-256: `533074b8fabe8d5b4ab1c1588535eacf29e3f7e4a49fe9056162a8ce85324a16`.
The mirror README provides track-specific Kevin MacLeod / CC BY 4.0 attribution.

Adaptations `menu-music.mp3` and `arsenal-music.mp3`: complete recordings, no
musical sections removed. Mono downmix before loudness normalization to -19 LUFS / -3 dBTP,
80 ms entrance and 250 ms exit fades, mono 32 kHz / 96 kbit/s MP3 to limit offline file
size and decoded memory. Only Southern Gothic changes tempo; pitch is preserved.
The source tempo/instrument metadata was checked against the catalog at
https://github.com/digitalforgeca/incompetech-royalty-free/blob/efe39b28b36c7a0c9f6510396b0cfddc87dd864a/pack.json

The two music loops are selected by room. Menu ambience stops indoors; gameplay
stops all background music. Re-entering a room cannot duplicate its loop.
Hovering over the Arsenal button uses the existing reload recording below.

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
