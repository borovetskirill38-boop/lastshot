# Western environment and character artwork

Original AI-generated artwork created for this project. Images are embedded as
inline data URLs by Vite and are also included in the standalone HTML. WebP
encoding uses quality 94 and preserves the character alpha channel. Playback
and rendering require no external image server.

- `town.webp`: sunlit saloon, weathered wood, iron barrel hoops, crate, dusty
  ground and distant mesas. The six dark window openings use the original game
  layout: vertical artwork landmarks are aligned once into a cached 960×540
  canvas texture. Foreground window sills are drawn over the character waists.
- `people.webp`: transparent four-column, two-row atlas. Top row: mustached
  outlaw, bandolier outlaw, scarred outlaw, gang boss. Bottom row: shopkeeper,
  woman with basket, ranch worker with rope, young reader. The three bandits
  retain red neckerchiefs; all four civilians have green clothing and no gun.

Character appearances cycle independently for each role. This changes their
appearance only; target geometry, difficulty, score and sound are unchanged.
All appearances reuse a single GPU texture instead of generating new images at
spawn time. The weapon remains a procedural Phaser model.
