/**
 * tabKeys.ts — which tab should get focus when the user presses a key in the tab row.
 * Owner: Dipson Gurung. Related: NFR11 (easy to use), ui-design rule 6 (WAI-ARIA tabs pattern).
 *
 * In the WAI-ARIA "tabs" pattern only the selected tab is a Tab-key stop; inside the tab row the
 * arrow keys move between tabs (wrapping round at the ends), Home goes to the first tab and End to
 * the last. Keeping this as a pure function means it can be tested without a browser.
 */

/**
 * The index of the tab to move to, or null if the key is not one the tab row handles (so the
 * browser can do its normal thing, e.g. Tab moves out of the row).
 */
export function nextTabIndex(current: number, key: string, tabCount: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % tabCount;
    case 'ArrowLeft':
      return (current - 1 + tabCount) % tabCount;
    case 'Home':
      return 0;
    case 'End':
      return tabCount - 1;
    default:
      return null;
  }
}
