/**
 * SidePanel.tsx — the side panel with three tabs: Trek, Plan and Layers.
 * Owner: Dipson Gurung. Related: docs/ui-design.md (layout rule 6, WAI-ARIA tabs pattern), #16.
 *
 * WAI-ARIA tabs pattern, as a screen reader and keyboard user expect it:
 * - the row has role="tablist"; each tab is a <button role="tab"> with aria-selected and
 *   aria-controls pointing at its panel; each panel has role="tabpanel" and aria-labelledby;
 * - only the selected tab is reachable with the Tab key (tabIndex 0, the others -1); inside the
 *   row, ArrowLeft/ArrowRight move between tabs (wrapping round) and Home/End jump to the ends
 *   (see tabKeys.ts). Moving with the keys also selects the tab ("automatic activation").
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { MessageKey } from '../i18n';
import { t, type Language } from '../i18n';
import { nextTabIndex } from './tabKeys';

export interface PanelTab {
  id: 'trek' | 'plan' | 'layers';
  labelKey: MessageKey;
  content: ReactNode;
}

interface SidePanelProps {
  tabs: PanelTab[];
  language: Language;
}

export function SidePanel({ tabs, language }: SidePanelProps) {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  /** Arrow keys / Home / End inside the tab row: select that tab and move focus to it. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextTabIndex(selected, event.key, tabs.length);
    if (next === null) return; // not our key: let the browser handle it (e.g. Tab)
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }

  return (
    <aside className="side-panel">
      <div
        role="tablist"
        aria-label={t('tabs.label', language)}
        className="tab-row"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={index === selected}
            tabIndex={index === selected ? 0 : -1}
            className="tab"
            onClick={() => setSelected(index)}
          >
            {t(tab.labelKey, language)}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={index !== selected}
          className="tab-panel"
        >
          {tab.content}
        </div>
      ))}
    </aside>
  );
}
