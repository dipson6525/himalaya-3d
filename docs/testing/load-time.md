# Load time (NFR2: first load within about 10 seconds on ordinary broadband)

Owner: Sparsh Gorkhali · Issues #30, #31 · Proposal section 3.8

## How to measure

- **Connection speed:** run a speed test (for example fast.com) just before, and write down the
  download speed in Mbps.
- **Cold load:** open a private/incognito window (empty cache), start a stopwatch or use the
  load-time script from #30, open the live site, stop when the globe shows terrain over Nepal.
- **Warm load:** reload the same window (files now cached) and time it again.
- **Lighthouse:** Chrome DevTools → Lighthouse → Performance, "Desktop", on the live site. Write
  down Largest Contentful Paint (LCP) and the Performance score, and save the report as
  `docs/testing/lighthouse-<date>.html`.

## Results

| # | Place / connection type (fibre, 4G, ...) | Download speed (Mbps) | Device | Browser + version | Cold load (s) | Warm load (s) | Lighthouse LCP (s) | Lighthouse score | ≤ 10 s? | Tester | Date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | |
| 6 | | | | | | | | | | | | |

## Summary (fill in after all rows)

- Connections tested: 
- Slowest cold load: 
- NFR2 met? (yes / no / partly, and why): 
