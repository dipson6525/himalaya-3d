/**
 * frameThrottle.ts — pass on only the latest value, at most once per animation frame.
 * Owner: Dipson Gurung. Related: issue #22, docs/ui-design.md ("updates it at most once per
 * animation frame").
 *
 * The mouse can report a position more often than the screen redraws (often 60 times a second).
 * Updating React state for every report would do work that is never seen. push() just remembers
 * the newest value; one requestAnimationFrame later, `send` gets it once.
 */
export interface FrameThrottle<T> {
  /** Remember `value`; it is sent at the next animation frame (only the newest one). */
  push(value: T): void;
  /** Forget a value that has not been sent yet (e.g. when the chart is removed). */
  cancel(): void;
}

/** Wraps `send` so it is called at most once per animation frame, with the newest value. */
export function frameThrottle<T>(send: (value: T) => void): FrameThrottle<T> {
  let waiting: { value: T } | null = null; // the newest value not sent yet
  let frame = 0; // id of the requested animation frame, 0 = none
  return {
    push(value) {
      waiting = { value };
      if (frame) return; // a frame is already coming: it will send the newest value
      frame = requestAnimationFrame(() => {
        frame = 0;
        const next = waiting;
        waiting = null;
        if (next) send(next.value);
      });
    },
    cancel() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      waiting = null;
    },
  };
}
