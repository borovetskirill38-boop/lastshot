# Audio sources and adaptation notes

Only the audio assets listed below are used. No affiliation or endorsement by
any source project or recordist is implied. Licenses apply to recordings, not
unrelated application code.

## Real revolver recordings — CC0 1.0

`shot-1.mp3` and `shot-2.mp3` are actual **Smith & Wesson 642, .38 Special**
revolver recordings, from **The Free Firearm Sound Library** by **Ben Jaszczak,
Brian Nelson, Kevin Heras and Matthew Nanney**. Source library:
https://opengameart.org/content/the-free-firearm-sound-library

Downloaded from the public Sidekick Sounds mirror, commit
`4f3a077c12057b4f91e14803a7e3c9d564f6afaa`:
https://github.com/blkpanfa/sidekick-sounds/tree/4f3a077c12057b4f91e14803a7e3c9d564f6afaa

The manifest identifies these as near-distance recordings, original `V_27P.wav`.
The original FLAC checksums were verified against that manifest before conversion:

| Adaptation | Original path                                 | Original SHA-256                                                 |
| ---------- | --------------------------------------------- | ---------------------------------------------------------------- |
| shot-1.mp3 | gun/revolver/smith-wesson-642-near-shot1.flac | bb0810dbe7d6ff00417e423a76ae38bf1aba23ea034ed3df51c5dfe7076c647a |
| shot-2.mp3 | gun/revolver/smith-wesson-642-near-shot2.flac | 48bc5670592b083a0260be6f1fd335178869876536abd12d1c10fe92e5d387df |

Processing: 35 Hz high-pass, mono, peak normalization to 0.8, tails trimmed/padded
to 1.35 / 0.55 seconds, 40 ms end fades, MP3 at 44.1 kHz / 128 kbit/s. No synthetic
oscillator, metal impact or pitch change is layered on the shot. The old generic
pistol samples have been replaced.

## Menu music and creak — Kenney, CC0 1.0

`menu-music.mp3`: **Farm Frolics**, Kenney Music Loops (Game Assets 1), a country
music loop. Source mirror, commit `728cdec1a41c1212bef2a175a4e7cd4f540df73d`:
https://github.com/DragonQuills/eevee-party/blob/728cdec1a41c1212bef2a175a4e7cd4f540df73d/assets/music/gameplay.ogg
The mirror README explicitly identifies this recording as Farm Frolics by Kenney.
Original SHA-256: dc3d5869790c43dc430b6a34d14a4c3f6ae0ed24d5a40a3090b27c19f098dbe6.
Processing: mono, peak normalization to 0.72, 32 kHz / 96 kbit/s MP3; complete loop retained.

The wooden creak in `menu-ambience.mp3` is `creak1.ogg` from Kenney RPG Audio.
Source mirror commit `af6119399400a89032d0bea568a53ec443aa44c7`:
https://github.com/violetferret/Game3/blob/af6119399400a89032d0bea568a53ec443aa44c7/assets/kenney_rpg-audio/Audio/creak1.ogg
Original SHA-256: 8a346186fd297254248cab8e8117060a52a5cf2a84f603153a762108550ea95e.

Kenney: https://kenney.nl/ . Both packs are distributed under CC0. A copy of the
Music Loops license is included in LICENSE-KENNEY-MUSIC.txt, and the CC0 legal
text is in LICENSE-CC0-1.0.txt.

## Voices, reload, impacts, wind — Red Eclipse, CC BY-SA 4.0

Copyright (C) 2009–2025 Red Eclipse Team. General sound-design credits include
xJoJox, Quinton "quin" Reeves, Sławek "Q009" Błauciak and garsipal. The ambience
credits name Quinton Reeves and Alex "blackshoe" Anguix.

Source commit: `ec74d59ea3b88f078122d2777103b3f06275b943`.
https://github.com/redeclipse/sounds/tree/ec74d59ea3b88f078122d2777103b3f06275b943
Original credits/license: the source repository's readme.txt.
License breakdown: https://github.com/redeclipse/base/blob/master/doc/all-licenses.txt
License: https://creativecommons.org/licenses/by-sa/4.0/
Full text included in LICENSE-CC-BY-SA-4.0.txt.

| Adaptation                           | Original path                           |
| ------------------------------------ | --------------------------------------- |
| bandit-death-1.mp3                   | player/death.ogg                        |
| bandit-death-2.mp3                   | player/death2.ogg                       |
| civilian-death.mp3                   | player/death4.ogg                       |
| pain-1.mp3 / pain-2.mp3 / pain-3.mp3 | player/pain.ogg / pain2.ogg / pain3.ogg |
| reload.mp3                           | weapons/pistol/reload.ogg               |
| wood-1.mp3 / wood-2.mp3              | weapons/thud.ogg / thud2.ogg            |
| menu-ambience.mp3 (wind layer)       | ambience/blowwind.ogg                   |

Voice adaptations: mono, high-pass, normalization, trimming/padding, end fades,
MP3 conversion. Death clips are separate recordings, not the old metallic hit.
Bandit deaths play at rate 0.96; the distinct civilian recording plays at 1.06.
Nonfatal boss hits use pain voices; the final hit uses bandit death. The old
`body.mp3` metallic impact is removed.

Reload is time-compressed to 1.1 seconds. Wood impacts retain a 380 Hz resonance
boost and low-pass filtering. The 12-second ambience mix contains a filtered,
attenuated excerpt of blowwind.ogg (seconds 6–18), with gentle loop-boundary fades,
and two attenuated Kenney creaks at 2.8 and 8.3 seconds. This combined ambience
adaptation is distributed under CC BY-SA 4.0, as are the other Red Eclipse adaptations.

All MP3 files are embedded in the standalone HTML as data URLs. Attribution and
license links also appear inside the game. No runtime audio download is needed.
