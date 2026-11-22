/**
 * i18n/index.ts — a tiny translation helper (no library needed).
 * Owner: Dipson Gurung. Related FR: FR9 (English/Nepali interface).
 *
 * Every piece of text the user can see lives in en.json and ne.json under the same key,
 * e.g. "app.title". Components call t('app.title') instead of hard-coding English.
 * TypeScript checks that every key used in code exists, and tests/i18n.test.ts checks that
 * both files have exactly the same keys. The language toggle arrives in M6 (issue #27).
 */
import en from './en.json';
import ne from './ne.json';

/** The languages the app supports. */
export type Language = 'en' | 'ne';

/** Every valid message key, taken from en.json (the reference dictionary). */
export type MessageKey = keyof typeof en;

/** Both dictionaries. Typing ne as Record<MessageKey, string> makes tsc fail if a key is missing. */
const dictionaries: Record<Language, Record<MessageKey, string>> = { en, ne };

/**
 * Look up the text for `key` in the chosen language (English by default).
 * Falls back to English, then to the key itself, so a missing string is visible but never crashes.
 *
 * Placeholders: a message may contain {name}-style holes, filled from `values`, e.g.
 * t('routes.showing', 'en', { name: 'Test Route', count: 2 }). Each language puts the holes
 * where its grammar needs them, which gluing fixed pieces together could not do. A hole with no
 * value is left as it is, so the mistake is visible.
 */
export function t(
  key: MessageKey,
  language: Language = 'en',
  values: Record<string, string | number> = {},
): string {
  const text = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (hole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : hole,
  );
}
