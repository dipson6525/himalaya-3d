/**
 * checker.ts — the acclimatization rules, as pure functions (no React, no Cesium).
 * Owner: Unique Ghimire. Related FR: FR5 (check an itinerary against acclimatization guidelines).
 *
 * GENERAL GUIDANCE, NOT MEDICAL ADVICE. The app must always show the disclaimer next to results.
 *
 * Source: Wilderness Medical Society clinical practice guidelines —
 *   Luks AM et al. Wilderness Environ Med 2019;30(4S):S3–S18, and the 2024 update
 *   (Luks AM, Beidleman BA, Freer L, et al. Wilderness Environ Med 2024;35(1_suppl):2S–19S),
 *   which keeps the same ascent rate: above 3,000 m, do not increase the SLEEPING elevation by more
 *   than 500 m per day, and take a rest day every 3–4 days.
 *
 * How we turn that into two checks (proposal section 3.6 and Figure 3.2). Let S_d be the
 * sleeping altitude on night d (night 1 is the first night of the trek):
 *   1. "Too fast": flag night d (d ≥ 2) when S_d > 3000 AND S_d − S_{d−1} > 500.
 *   2. "Rest day needed": count how many nights in a row the trekker has slept higher than the
 *      night before while above 3,000 m. A rest day (same altitude) or a descent resets the count,
 *      and so does a night at or below 3,000 m. Flag every night where the count is more than 3.
 * Both comparisons are strict (>), so exactly 3,000 m and exactly 500 m are NOT flagged.
 */

/** Sleeping altitude (m) above which the ascent-rate guidance applies. */
export const ACCLIMATIZATION_THRESHOLD_M = 3000;

/** Largest allowed increase in sleeping altitude from one night to the next (m), above the threshold. */
export const MAX_SLEEP_GAIN_PER_NIGHT_M = 500;

/** Nights in a row of sleeping higher (above the threshold) that are allowed before a rest day. */
export const MAX_NIGHTS_GAINING_WITHOUT_REST = 3;

/** One warning about one night. The UI turns it into words with t() in the chosen language. */
export type AcclimatizationFlag =
  | {
      /** Night number, starting at 1. */
      night: number;
      rule: 'too-fast';
      /** S_d − S_{d−1} in metres (always more than 500). */
      gainM: number;
    }
  | {
      night: number;
      rule: 'rest-day-needed';
      /** How many nights in a row the sleeping altitude has gone up above 3,000 m (always > 3). */
      nightsGaining: number;
    };

/**
 * Check a list of sleeping altitudes, one per night, and return every warning.
 *
 * Example (synthetic numbers): [2800, 3200, 3800] → night 3 is flagged "too-fast" (gain 600 m,
 * above 3,000 m); night 2 is not (gain 400 m).
 *
 * Throws a RangeError if an altitude is not a finite number of metres ≥ 0, because that is a bug
 * in the caller, not a property of the itinerary.
 */
export function checkItinerary(sleepingAltitudesM: readonly number[]): AcclimatizationFlag[] {
  sleepingAltitudesM.forEach((altitude, index) => {
    if (!Number.isFinite(altitude) || altitude < 0) {
      throw new RangeError(`night ${index + 1}: altitude must be a number of metres ≥ 0`);
    }
  });

  const flags: AcclimatizationFlag[] = [];
  let nightsGaining = 0; // the "g" counter in the proposal's flowchart

  // Night 1 has no previous night to compare with, so the checks start at night 2.
  for (let index = 1; index < sleepingAltitudesM.length; index += 1) {
    const night = index + 1;
    const tonight = sleepingAltitudesM[index];
    const lastNight = sleepingAltitudesM[index - 1];
    const gainM = tonight - lastNight;
    const aboveThreshold = tonight > ACCLIMATIZATION_THRESHOLD_M;

    // Rule 1: too fast.
    if (aboveThreshold && gainM > MAX_SLEEP_GAIN_PER_NIGHT_M) {
      flags.push({ night, rule: 'too-fast', gainM });
    }

    // Rule 2: rest day needed. Only nights spent higher, above the threshold, keep the run going.
    if (aboveThreshold && gainM > 0) {
      nightsGaining += 1;
    } else {
      nightsGaining = 0;
    }
    if (nightsGaining > MAX_NIGHTS_GAINING_WITHOUT_REST) {
      flags.push({ night, rule: 'rest-day-needed', nightsGaining });
    }
  }
  return flags;
}

/** The part of a route stop the itinerary needs (see app/src/features/routes/types.ts). */
export interface StopForNights {
  id: string;
  day: number;
  altitude_m: number;
}

/** One night of an itinerary: where the trekker sleeps and at what altitude. */
export interface Night {
  stopId: string;
  altitudeM: number;
}

/**
 * Turn a route's stops into one entry per night (the route file has no separate rest-day field).
 *
 * Nights at a stop = next stop's day − this stop's day (docs/data-schema.md). The last stop counts
 * as one night. Example: stops on days 1, 2 and 4 → nights at A, B, B, C (night 3 is a rest day at B).
 *
 * Throws a RangeError if the days do not start at 1 and increase, which the route schema
 * validator already guarantees for files in data/routes/.
 */
export function nightsFromStops(stops: readonly StopForNights[]): Night[] {
  const nights: Night[] = [];
  stops.forEach((stop, index) => {
    const next = stops[index + 1];
    const nightsHere = next ? next.day - stop.day : 1;
    const firstDayOk = index > 0 || stop.day === 1;
    if (!firstDayOk || nightsHere < 1 || !Number.isInteger(nightsHere)) {
      throw new RangeError(`stop ${stop.id}: days must start at 1 and increase`);
    }
    for (let count = 0; count < nightsHere; count += 1) {
      nights.push({ stopId: stop.id, altitudeM: stop.altitude_m });
    }
  });
  return nights;
}
