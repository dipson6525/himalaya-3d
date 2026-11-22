/**
 * tabKeys.test.ts — keyboard movement in the side-panel tab row (WAI-ARIA tabs pattern).
 * Owner: Dipson Gurung. Related: NFR11, ui-design rule 6.
 */
import { describe, expect, it } from 'vitest';
import { nextTabIndex } from './tabKeys';

describe('nextTabIndex (3 tabs: 0 Trek, 1 Plan, 2 Layers)', () => {
  it('ArrowRight moves to the next tab and wraps from the last to the first', () => {
    expect(nextTabIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextTabIndex(2, 'ArrowRight', 3)).toBe(0);
  });

  it('ArrowLeft moves to the previous tab and wraps from the first to the last', () => {
    expect(nextTabIndex(1, 'ArrowLeft', 3)).toBe(0);
    expect(nextTabIndex(0, 'ArrowLeft', 3)).toBe(2);
  });

  it('Home and End jump to the first and last tab', () => {
    expect(nextTabIndex(1, 'Home', 3)).toBe(0);
    expect(nextTabIndex(1, 'End', 3)).toBe(2);
  });

  it('ignores other keys (Tab must still leave the tab row)', () => {
    expect(nextTabIndex(1, 'Tab', 3)).toBeNull();
    expect(nextTabIndex(1, 'a', 3)).toBeNull();
  });
});
