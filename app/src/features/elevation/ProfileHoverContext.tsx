/**
 * ProfileHoverContext.tsx — the provider for the one fast-changing value shared by the profile
 * chart and the globe: the distance along the trail the user is pointing at (FR4, issue #22).
 * Owner: Dipson Gurung. Design: docs/ui-design.md, "fast-changing values get their own small
 * context". The context object and the hook to read it are in profileHover.ts (a file with only
 * components keeps React's fast refresh working).
 *
 * Moving the mouse over the chart changes this value many times a second. If App held it, every
 * change would re-render the whole page. Instead the value lives in ProfileHoverProvider, a
 * component of its own: when it changes, React re-renders only the components that READ the
 * context (the chart strip and the globe marker). The `children` App passes in are elements it
 * already made, so they are not rebuilt.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ProfileHoverContext } from './profileHover';

/** Holds the highlighted distance for everything inside it. */
export function ProfileHoverProvider({ children }: { children: ReactNode }) {
  const [highlightM, setHighlightM] = useState<number | null>(null);
  // useMemo: a new object only when the value changes, so readers re-render only then.
  const value = useMemo(() => ({ highlightM, setHighlightM }), [highlightM]);
  return <ProfileHoverContext.Provider value={value}>{children}</ProfileHoverContext.Provider>;
}
