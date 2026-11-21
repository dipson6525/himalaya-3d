/**
 * checker.test.ts — the acclimatization test matrix.
 * Owner: Unique Ghimire. Related FR: FR5.
 *
 * Every itinerary here is a list of SYNTHETIC sleeping altitudes chosen to hit one rule or one
 * edge case. They are not real treks and not real altitudes of real places.
 * Rule 1 "too fast": S_d > 3000 and S_d − S_{d−1} > 500.
 * Rule 2 "rest day needed": more than 3 nights in a row sleeping higher, above 3000 m.
 */
import { describe, expect, it } from 'vitest';
import { checkItinerary, nightsFromStops, type AcclimatizationFlag } from './checker';

/** Just the rule names per night, e.g. ['3:too-fast'], so expectations stay short. */
function summary(flags: AcclimatizationFlag[]): string[] {
  return flags.map((flag) => `${flag.night}:${flag.rule}`);
}

describe('checkItinerary — rule 1, too fast', () => {
  it('flags a 600 m gain to a night above 3000 m', () => {
    expect(checkItinerary([2800, 3200, 3800])).toEqual([
      { night: 3, rule: 'too-fast', gainM: 600 },
    ]);
  });

  it('does not flag big gains while still at or below 3000 m', () => {
    expect(checkItinerary([1400, 2200, 2900])).toEqual([]);
  });

  it('edge: arriving at exactly 3000 m is not above 3000 m, so +600 is not flagged', () => {
    expect(checkItinerary([2400, 3000])).toEqual([]);
  });

  it('edge: 3001 m with a gain of 501 m is flagged', () => {
    expect(summary(checkItinerary([2500, 3001]))).toEqual(['2:too-fast']);
  });

  it('edge: a gain of exactly 500 m is allowed', () => {
    expect(checkItinerary([2501, 3001])).toEqual([]);
    expect(checkItinerary([3000, 3500])).toEqual([]);
  });

  it('edge: a gain of 501 m above 3000 m is flagged', () => {
    expect(checkItinerary([3000, 3501])).toEqual([{ night: 2, rule: 'too-fast', gainM: 501 }]);
  });

  it('never flags night 1 (there is no night before it)', () => {
    expect(checkItinerary([4500])).toEqual([]);
  });
});

describe('checkItinerary — rule 2, rest day needed', () => {
  it('flags the 4th night in a row of sleeping higher above 3000 m', () => {
    // nights 2-5 each 200 m higher: counts 1, 2, 3, 4 → night 5 is flagged
    expect(checkItinerary([3100, 3300, 3500, 3700, 3900])).toEqual([
      { night: 5, rule: 'rest-day-needed', nightsGaining: 4 },
    ]);
  });

  it('keeps flagging while the run continues', () => {
    expect(summary(checkItinerary([3100, 3300, 3500, 3700, 3900, 4100]))).toEqual([
      '5:rest-day-needed',
      '6:rest-day-needed',
    ]);
  });

  it('edge: exactly three nights gaining is allowed', () => {
    expect(checkItinerary([3100, 3300, 3500, 3700])).toEqual([]);
  });

  it('a rest day (same altitude) resets the count', () => {
    // counts: 1, 2, 0 (rest), 1, 2, 3 → nothing flagged
    expect(checkItinerary([3100, 3300, 3500, 3500, 3700, 3900, 4100])).toEqual([]);
  });

  it('a descent resets the count', () => {
    expect(checkItinerary([3100, 3300, 3500, 3400, 3600, 3800, 4000])).toEqual([]);
  });

  it('gains at or below 3000 m do not count towards the run', () => {
    // 2600 → 2800 → 3000 are gains but not above 3000 m; counting starts at 3200:
    // counts 0, 0, 1, 2, 3 → nothing flagged. (If the 3000 m condition were missing from the
    // counter, nights 5 and 6 would be flagged — this test would catch that.)
    expect(checkItinerary([2600, 2800, 3000, 3200, 3400, 3600])).toEqual([]);
  });

  it('starts counting from the first night above 3000 m', () => {
    // 2900 → 3100 is the first gaining night above 3000 m: counts 1, 2, 3, 4 → night 5
    expect(summary(checkItinerary([2900, 3100, 3300, 3500, 3700]))).toEqual(['5:rest-day-needed']);
  });
});

describe('checkItinerary — both rules and safe plans', () => {
  it('reports both rules on the same night when both apply', () => {
    // nights 2-4 gain 300 m (counts 1-3), night 5 gains 600 m (too fast AND count 4)
    expect(summary(checkItinerary([3100, 3400, 3700, 4000, 4600]))).toEqual([
      '5:too-fast',
      '5:rest-day-needed',
    ]);
  });

  it('a synthetic safe plan with rest days gives no warnings', () => {
    const plan = [2800, 3300, 3300, 3700, 4100, 4100, 4500, 4900, 4900, 4400];
    expect(checkItinerary(plan)).toEqual([]);
  });

  it('an empty itinerary gives no warnings', () => {
    expect(checkItinerary([])).toEqual([]);
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], [-1]])(
    'rejects an impossible altitude (%s) instead of guessing',
    (bad) => {
      expect(() => checkItinerary([3000, bad])).toThrow(RangeError);
    },
  );
});

describe('nightsFromStops', () => {
  const stop = (id: string, day: number, altitude_m: number) => ({ id, day, altitude_m });

  it('days 1, 2, 4 → A, B, B, C (night 3 is a rest day at B)', () => {
    const nights = nightsFromStops([stop('a', 1, 2800), stop('b', 2, 3300), stop('c', 4, 3700)]);
    expect(nights.map((night) => night.stopId)).toEqual(['a', 'b', 'b', 'c']);
    expect(nights.map((night) => night.altitudeM)).toEqual([2800, 3300, 3300, 3700]);
  });

  it('feeds straight into the checker', () => {
    const nights = nightsFromStops([stop('a', 1, 2800), stop('b', 2, 3400)]);
    expect(checkItinerary(nights.map((night) => night.altitudeM))).toEqual([
      { night: 2, rule: 'too-fast', gainM: 600 },
    ]);
  });

  it.each([
    [[stop('a', 2, 3000)]], // does not start at day 1
    [[stop('a', 1, 3000), stop('b', 1, 3100)]], // same day twice
    [[stop('a', 1, 3000), stop('b', 2.5, 3100)]], // not a whole day
  ])('rejects days that do not start at 1 and increase', (stops) => {
    expect(() => nightsFromStops(stops)).toThrow(RangeError);
  });
});
