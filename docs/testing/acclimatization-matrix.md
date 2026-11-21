# Acclimatization checker test matrix (FR5)

Owner: Unique Ghimire · Issues #23, #31 · Proposal section 3.8 ("tested with itineraries that are
known to be safe and unsafe")

The checker (`app/src/lib/acclim/checker.ts`) follows the Wilderness Medical Society guidance
(Luks et al. 2019; 2024 update). S_d = sleeping altitude on night d.

- **Rule 1, too fast:** flag night d if S_d > 3000 m and S_d − S_{d−1} > 500 m.
- **Rule 2, rest day needed:** flag every night where the sleeping altitude has gone up, above
  3000 m, on more than 3 nights in a row (a rest day, a descent or a night at/below 3000 m resets).

All itineraries are **synthetic** (made-up altitudes chosen to test one rule or edge), not real
treks. The "Expected" column follows from the rules above; the "Result" column is filled in by
the person who runs the tests (`cd app && npx vitest run src/lib/acclim/checker.test.ts`), with
the date. Each row matches a test in `checker.test.ts`.

| # | Case | Sleeping altitudes (m), night 1 → n | Expected flags | Result (pass / fail) | Run by, date |
| --- | --- | --- | --- | --- | --- |
| A1 | 600 m gain above 3000 m | 2800, 3200, 3800 | night 3 too fast (+600) | | |
| A2 | Big gains below 3000 m | 1400, 2200, 2900 | none | | |
| A3 | Edge: arrive at exactly 3000 m (+600) | 2400, 3000 | none | | |
| A4 | Edge: 3001 m with +501 | 2500, 3001 | night 2 too fast | | |
| A5 | Edge: gain of exactly 500 m | 2501, 3001 · 3000, 3500 | none | | |
| A6 | Edge: gain of 501 m above 3000 m | 3000, 3501 | night 2 too fast (+501) | | |
| A7 | Night 1 is never compared | 4500 | none | | |
| B1 | 4 nights in a row higher above 3000 m | 3100, 3300, 3500, 3700, 3900 | night 5 rest day needed | | |
| B2 | Run continues | 3100, 3300, 3500, 3700, 3900, 4100 | nights 5 and 6 rest day needed | | |
| B3 | Edge: exactly 3 nights gaining | 3100, 3300, 3500, 3700 | none | | |
| B4 | Rest day resets | 3100, 3300, 3500, 3500, 3700, 3900, 4100 | none | | |
| B5 | Descent resets | 3100, 3300, 3500, 3400, 3600, 3800, 4000 | none | | |
| B6 | Gains at/below 3000 m do not count | 2600, 2800, 3000, 3200, 3400, 3600 | none | | |
| B7 | Run starts at the first night above 3000 m | 2900, 3100, 3300, 3500, 3700 | night 5 rest day needed | | |
| C1 | Both rules on one night | 3100, 3400, 3700, 4000, 4600 | night 5 too fast and rest day needed | | |
| C2 | Safe plan with rest days | 2800, 3300, 3300, 3700, 4100, 4100, 4500, 4900, 4900, 4400 | none | | |
| C3 | Empty itinerary | (none) | none | | |
| C4 | Impossible altitude (NaN, Infinity, −1) | 3000, NaN | error, not a guess | | |

Add rows here when you add tests, and keep the two in step.
