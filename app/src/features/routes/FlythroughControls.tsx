/**
 * FlythroughControls.tsx — the Play / Pause button for the flythrough, in the Trek tab.
 * Owner: Sparsh Gorkhali. Related FR: FR3, issues #19 (this button) and #20 (speed, jump to day).
 *
 * "Commands are method calls, not state" (docs/ui-design.md): pressing the button calls
 * controller.play() or controller.pause(); the controller reports its status back, and the label
 * follows the status. The button is disabled while there is no controller (no route shown yet).
 *
 * While the flight line is being prepared the button only LOOKS disabled (aria-disabled) and
 * ignores presses. A really `disabled` button loses keyboard focus: a keyboard user who pressed
 * Play would find the focus gone and their next Enter (to pause) would do nothing. The e2e test
 * found this.
 */
import type {
  FlythroughController,
  FlythroughStatus,
} from '../../engine/flythrough/FlythroughController';
import { t, type Language, type MessageKey } from '../../i18n';

interface FlythroughControlsProps {
  controller: FlythroughController | null;
  status: FlythroughStatus;
  /** How far the flythrough has got, in metres (shown to the e2e test as data-distance). */
  distanceM: number;
  language: Language;
}

/** The button text for each status. */
function labelKey(status: FlythroughStatus): MessageKey {
  if (status === 'playing') return 'fly.pause';
  if (status === 'preparing') return 'fly.preparing';
  if (status === 'paused') return 'fly.resume';
  return 'fly.play'; // idle, finished (starts again), error (try again)
}

/** Play / Pause button plus an error line if the flythrough could not start. */
export function FlythroughControls({
  controller,
  status,
  distanceM,
  language,
}: FlythroughControlsProps) {
  const playing = status === 'playing';
  const preparing = status === 'preparing';
  return (
    <div className="flythrough-controls">
      <button
        type="button"
        className="fly-button"
        data-testid="flythrough-toggle"
        data-status={status}
        data-distance={Math.round(distanceM)}
        disabled={!controller}
        aria-disabled={preparing}
        onClick={() => {
          if (preparing) return; // wait until it is ready (see the header comment)
          if (playing) controller?.pause();
          else void controller?.play();
        }}
      >
        {t(labelKey(status), language)}
      </button>
      {status === 'error' && <p role="alert">{t('fly.error', language)}</p>}
    </div>
  );
}
