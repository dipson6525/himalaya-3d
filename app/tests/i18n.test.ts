/**
 * i18n.test.ts — checks that the English and Nepali dictionaries stay in sync.
 * Owner: Dipson Gurung. Related FR: FR9.
 *
 * If someone adds a string to en.json but forgets ne.json (or the other way round),
 * this test fails in CI, so a half-translated screen can never be merged.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';
import en from '../src/i18n/en.json';
import ne from '../src/i18n/ne.json';

describe('i18n dictionaries', () => {
  it('en.json and ne.json have exactly the same keys', () => {
    expect(Object.keys(ne).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(ne)]) {
      expect(value.trim(), `value for "${key}"`).not.toBe('');
    }
  });

  it('t() returns the text for the chosen language, English by default', () => {
    expect(t('app.title')).toBe('Himalaya 3D');
    expect(t('app.title', 'en')).toBe(en['app.title']);
    expect(t('app.title', 'ne')).toBe(ne['app.title']);
  });
});
