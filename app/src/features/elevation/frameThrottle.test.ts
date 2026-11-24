/**
 * frameThrottle.test.ts — at most one call per animation frame, with the newest value (#22).
 * Owner: Dipson Gurung. requestAnimationFrame is replaced so the test runs frames by hand.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameThrottle } from './frameThrottle';

let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(0));
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frameThrottle', () => {
  it('three pushes before a frame give one call, with the newest value', () => {
    const send = vi.fn();
    const throttle = frameThrottle<number>(send);
    throttle.push(1);
    throttle.push(2);
    throttle.push(3);
    expect(send).not.toHaveBeenCalled(); // nothing until the frame
    expect(frames).toHaveLength(1); // and only one frame asked for
    runFrame();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(3);
  });

  it('a push after a frame asks for the next frame', () => {
    const send = vi.fn();
    const throttle = frameThrottle<number | null>(send);
    throttle.push(1);
    runFrame();
    throttle.push(null); // null is a value too ("nothing highlighted")
    runFrame();
    expect(send.mock.calls).toEqual([[1], [null]]);
  });

  it('cancel forgets the waiting value', () => {
    const send = vi.fn();
    const throttle = frameThrottle<number>(send);
    throttle.push(1);
    throttle.cancel();
    runFrame();
    expect(send).not.toHaveBeenCalled();
  });
});
