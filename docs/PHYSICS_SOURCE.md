# AF 2.6 Missile / SAM physics source note

AF 2.6 deliberately keeps the Reborn UI, renderer, missile artwork, explosions,
rapid-fire AAA, economy, research, audio and multiplayer architecture.

Only the **non-visual offensive-missile and SAM movement/engagement model** was
adapted from the user-supplied `Azarakhsh Front V3` reference (`Pasted text(3).txt`).
No CSS, menus, rendering code, explosion drawing, AAA implementation or unrelated
logic was copied from the reference.

## Imported / adapted behavior

- Reference missile ground speeds: ballistic 102, cruise 126, hypersonic 208,
  drone 44, rain carrier 96 and heavy 78 game-units/second.
- Reference Arcade / Realistic duration clamps.
- Realistic targeting spread bands and the locked-target 0.62 error multiplier.
- High-arc family split timing: rain 0.44, realistic hypersonic 0.42, other
  ballistic-family weapons 0.46.
- High-arc ascent: vertical-first boost, delayed turn toward apex and a small
  randomized lateral ascent arc.
- Descent: ballistic/rain/heavy use the reference eased fall; hypersonic uses the
  much later/steeper reference terminal descent.
- Cruise remains a low, straight ground-track weapon and is never assigned a SAM.
- Rain carrier opens at 64% flight progress and releases six staggered fan
  submunitions.
- SAM engagement begins from 20% missile progress and predicts a **future point on
  the missile trajectory**, rather than waiting for the missile to enter the SAM's
  current-position circle or simply firing at the final impact point.
- Tracked SAM lead/caps: ballistic +0.16 / 0.94, hyper +0.09 / 0.90, other
  ballistic-family +0.12 / 0.90. Blind SAM uses the wider +0.20/+0.11/+0.14
  leads and lower caps from the reference.
- SAM interceptor flight uses one frozen aim point and the reference
  smoothstep + sinusoidal lateral bend. It does not home, retarget or perform the
  old snap-turn after launch.
- Multiple physical SAM sites may launch at the same threat, while the defense
  network makes one kill/pass decision so extra launchers do not silently reroll
  the probability into near-certainty.

## Deliberate Reborn adaptations

The old reference and Reborn do not use the same renderer/world representation.
The reference 2D apex/vertical curve is mapped to Reborn's `z` altitude, so the
same normalized timing/shape is preserved without importing old graphics.
Reborn's existing HP/economy/damage scale, graphics, explosion system and AAA are
kept. The reference is therefore the source of **missile/SAM dynamics**, not a
whole-game code transplant.
