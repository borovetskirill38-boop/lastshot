# Western environment and character artwork

Original AI-generated artwork created for this project. Images are embedded as
inline data URLs by Vite and are also included in the standalone HTML. WebP
encoding uses quality 94 for the town, people and doors, 92 for the menu
background and 96 for the weapon; transparency is preserved. Playback
and rendering require no external image server.

- `town.webp`: sunlit saloon, weathered wood, iron barrel hoops, crate, dusty
  ground and distant mesas. The six furnished window openings use the original game
  layout: vertical artwork landmarks are aligned once into a cached 960×540
  canvas texture. Foreground window sills are drawn over the character waists. The exterior now includes broad porch steps, handrails, lanterns, buckets, rope, flowers and a saddle. Upstairs openings show three distinct furnished bedrooms; downstairs show a kitchen, drinking hall and carved bar. Room detail is visible rather than black.
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

## Workshop and selectable weapons

- `workshop.webp`: original carpenter/gunsmith room, lantern, hand tools, wooden
  workbench and frontier props. Quality 92 WebP, used as the workshop background.
- `weapon-icons.webp`: original unbranded realistic revolver profile atlas,
  1254×1254. Measured row bounds are 0–500, 500–880 and 880–1254. SVG view boxes
  and clipping isolate each full silhouette while preserving its proportions.
  Names are fictional; no manufacturer logos or third-party icon packs are used.
- `arsenal-models.webp`: transparent 1536×1024 atlas with two first-person models:
  compact pocket revolver (left) and brass-accent long revolver (right). Quality
  96 WebP; the six-shot classic retains `revolver-hand.webp`. Each appearance has
  measured muzzle/cylinder anchors and flash direction, sharing the same effects.

Selection and statistics do not depend on artwork decoding or image pixels. The
selected model and magazine capacity apply when a new run begins. Images remain
embedded in the standalone HTML; no network is needed for the workshop.

## Twilight street

- `street-dusk.webp`: original AI-generated 1672×941 panorama, WebP quality 94.
  Frontier houses and verandas line both sides of a dusty street; a wooden wagon,
  cargo crates and oak barrels provide foreground cover. Oil lamps complement
  readable early twilight, with a peach/lavender sky and distant mesas.
- `map-saloon-preview.webp`, `map-street-preview.webp`: small WebP derivatives of
  the two environments, at most 320×196, quality 88, for the menu selector.

The street uses the same fixed 960×540 world as the saloon. Its target centers,
distance scales, cover tops and boss position are measured in `src/maps.js`.
Cached crops of the panorama at depth 15 mask the character waists at depth 10;
hit testing uses those same cover tops. The upper-body sprites receive a subtle
twilight tint. Spawn emergence uses game time, so pause freezes it. Changing maps
destroys the old scenery objects while keeping shared textures loaded once.

## Saloon interior

- `tavern.webp`: original AI-generated 1672×941 panorama, WebP quality 94. A
  carved bar with mirror, bottles and glasses, a back storeroom, overturned round
  and rectangular tables, barrels, upright piano, staircase and upper gallery.
  Warm kerosene lamps mix with cool evening window light; no people are painted
  into the environment.
- `map-tavern-preview.webp`: small menu derivative, maximum 320×196, quality 88.

The original six target positions have measured scale, warm tint and cover
profiles. The upper edges in `src/maps.js` define both the cached 960×540 alpha
foreground and hit testing: a round table curves, and the bar slopes with
perspective. The foreground texture is created once on the first interior visit;
subsequent visits reuse it. Two scenery images restore the original room; two additional prop images add new foreground cover.
Emergence uses the existing pause-safe gameplay clock. All assets remain embedded
in the standalone HTML, including the selector preview and menu background.

## Conversation portraits

- `dialogue-portraits.webp`: original AI-generated transparent 2172×724 atlas,
  quality 92 WebP. Three equal square cells: the player sheriff with a brass star
  and light hat, a mustached bandit with a red neckerchief, and the older gang boss
  with gray beard, cheek scar and silver hat band. The sheriff faces right and
  both opponents face left, toward the other participant.

CSS reuses one inline image for both portrait frames. The left frame always shows
the sheriff; normal levels use the middle bandit cell. Boss encounters now use the
shared boss/hostage atlas below instead of the legacy third portrait. The active speaker is highlighted and its speech box
aligns to that side. On narrow screens both portraits sit above the speech box,
keeping their left/right order. Reduced motion removes the highlight transition.
No gameplay sprites, spawn rules or weapon effects depend on these portraits.

## Billy Bullet and Suzzie

- `boss-encounter.webp`: original AI-generated transparent 2172×724 atlas,
  quality 94 WebP. Three equal cells: the boss alone, the same boss restraining
  Suzzie in front of himself, and Suzzie alone. His gray beard, scar, silver hat band,
  burgundy waistcoat and red cravat match across both poses. Suzzie is an adult
  frontier saloon waitress, wearing a modest high-neck cream blouse, green
  waistcoat, apron and pinned brown hair. The pair is unharmed and non-graphic.

The first cell is used verbatim both for the boss conversation portrait and his
combat sprite; the third similarly serves Suzzie's dialogue and rescued appearance.
The middle cell is the protected hostage pose. Sprites preserve cell proportions,
share one Phaser texture, and use each cover's scale and foreground mask. CSS uses
the same embedded image for dialogue frames. The old boss cell in `people.webp`
is no longer used in combat. Position changes, phases and pause all use game time;
no new image is created at each appearance. All assets work in the standalone HTML.

## Additional cover on the street and inside the saloon

- `cover-props.webp`: original AI-generated transparent 1254×1254 atlas, quality
  94 WebP. Four measured frames: horse water trough and overturned handcart in
  twilight lighting, and a closed supply chest and beer crates in amber light.
  All four share one preloaded texture; no network or per-spawn image creation.
- `src/props.js` stores atlas frames, alpha-measured upper silhouettes, world
  placement and the two extra spawn positions per map. Upper profiles come from
  the visible silhouette (alpha > 127), then transform into the fixed 960×540
  world. The same profiles stop covered shots and identify wooden impacts.
- Existing furniture remains at depth 15. Characters at the new foreground
  obstacles use depth 20, and the transparent props at depth 25 hide their waists.
  Regular enemies, civilians and Billy with or without Suzzie share this rule.
- Each street/interior now has eight positions. All three menu previews are
  captured from actual game rendering without characters, weapons or crosshair.

The saloon facade was edited from the original image with image generation,
retaining all six window frame landmarks and the original noon lighting.
