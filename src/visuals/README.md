# Western environment and character artwork

Original AI-generated artwork created for this project. Images are embedded as
inline data URLs by Vite and are also included in the standalone HTML. WebP
encoding uses quality 94 for the town, people and doors, 92 for the menu
background and 96 for the weapon; transparency is preserved. Playback
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
spawn time.

- `menu-town.webp`: sunset frontier street viewed from a saloon veranda, with
  oil lanterns, mesas, porches and warm sunlight. CSS adds subtle animated dust,
  lantern light and a tumbleweed. Hidden tabs pause the animation; reduced-motion
  preferences stop it.
- `saloon-doors.webp`: one transparent pair of wooden batwing doors, split into
  left and right leaves by CSS for accessible level buttons and entrance motion.
- `revolver-hand.webp`: transparent first-person revolver and right-hand artwork,
  with worn steel, walnut, skin detail and leather cuff. The muzzle and cylinder
  anchors are measured on this sprite so light, smoke and brass follow the model.

The weapon uses gameplay delta for aim lag, breathing, recoil and reload lowering.
The light flare and brass case use small cached canvas textures. Pausing freezes
all weapon animation and a new run clears the effects. All artwork is shared and
loaded once; no image is generated or downloaded per shot.
