/**
 * profileHover.ts — the context object for the highlighted distance along the trail, and the
 * hook that reads it (issue #22). The provider is in ProfileHoverContext.tsx.
 * Owner: Dipson Gurung.
 */
import { createContext, useContext } from 'react';

/** What the chart and the globe marker share. */
export interface ProfileHover {
  /** Metres along the trail line, or null when nothing is pointed at. */
  highlightM: number | null;
  setHighlightM: (distanceM: number | null) => void;
}

/** Outside a provider: nothing highlighted, and setting does nothing. */
export const ProfileHoverContext = createContext<ProfileHover>({
  highlightM: null,
  setHighlightM: () => {},
});

/** Read (and set) the highlighted distance along the trail. */
export function useProfileHover(): ProfileHover {
  return useContext(ProfileHoverContext);
}
