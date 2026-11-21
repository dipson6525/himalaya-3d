# Frame rate by laptop (NFR1: ≥ 30 fps on integrated graphics)

Owner: Sparsh Gorkhali · Issues #29, #31 · Proposal section 3.8

## How to measure

1. Open the live site in the browser named in the row; wait until the terrain has finished loading.
2. Turn on the FPS overlay (issue #29). Until #29 is merged, use Chrome DevTools → More tools →
   Rendering → **Frame Rendering Stats** instead, and say so in the Notes column.
3. For each scene, watch for 30 seconds and write down the typical (median) and the lowest value.
   - **Idle:** start view, no input. (With request-render mode, Cesium may draw very few frames
     when nothing moves; write what the meter shows and note "idle".)
   - **Panning:** drag the globe slowly left and right over Nepal for the whole 30 s.
   - **Flythrough:** play the Everest Base Camp flythrough at 1× (once #19/#20 exist).
4. Plug the laptop in, close other heavy apps, and note the battery/power mode.

## Results

| # | Laptop model | CPU | Graphics (integrated / dedicated, model) | RAM | Browser + version | Screen size / resolution | Scene | Typical fps | Lowest fps | ≥ 30? | Tester | Date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | Idle | | | | | | |
| 2 | | | | | | | Panning | | | | | | |
| 3 | | | | | | | Flythrough | | | | | | |
| 4 | | | | | | | Idle | | | | | | |
| 5 | | | | | | | Panning | | | | | | |
| 6 | | | | | | | Flythrough | | | | | | |
| 7 | | | | | | | Idle | | | | | | |
| 8 | | | | | | | Panning | | | | | | |
| 9 | | | | | | | Flythrough | | | | | | |

At least one laptop must have **integrated graphics only** (proposal Table 4.2).

## Summary (fill in after all rows)

- Laptops tested: 
- Lowest typical fps on integrated graphics: 
- NFR1 met? (yes / no / partly, and why): 
