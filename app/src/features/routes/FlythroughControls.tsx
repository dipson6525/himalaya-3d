/**
 * FlythroughControls.tsx — the flythrough controls in the Trek tab: Play / Pause, Speed and
 * "Jump to the start of day N".
 * Owner: Sparsh Gorkhali. Related FR: FR3, issues #19 (Play / Pause) and #20 (speed, jump to day).
 *
 * - Speed is a native <select> (a value the user sets, kept in App; App passes it on with
 *   controller.setSpeed). Changing it while playing takes effect from the next frame.
 * - The day buttons are buttons, not a <select>: a select that acts on every change would jump
 *   once per arrow-key press for keyboard users (Chromium on Windows changes a closed select
 *   with the arrow keys). One button per day with a stage (rest days have none).
 *
 * "Commands are method calls, not state" (docs/ui-design.md): pressing the button calls
 * controller.play() or controller.pause(); the controller reports its status back, and the label
 * follows the status. The button is only shown once a route is loaded; it is disabled if there
 * is still no controller, which means the 3D globe itself could not start (for example no WebGL;
 * Cesium then shows its own error message in the globe area).
 *
 * While the flight line is being prepared the button only LOOKS disabled (aria-disabled) and
 * ignores presses. A really `disabled` button loses keyboard focus: a keyboard user who pressed
 * Play would find the focus gone and their next Enter (to pause) would do nothing. The e2e test
 * found this.
 */
import {
  SPEED_CHOICES,
  type FlythroughController,
  type FlythroughStatus,
} from '../../engine/flythrough/FlythroughController';
import { t, type Language, type MessageKey } from '../../i18n';
import { isForwardStage, type Stage } from '../../lib/geo/stages';

interface FlythroughControlsProps {
  controller: FlythroughController | null;
  status: FlythroughStatus;
  /** How far the flythrough has got, in metres (shown to the e2e test as data-distance). */
  distanceM: number;
  language: Language;
  /** Current speed, as a multiple of the normal speed (one of SPEED_CHOICES). */
  speed: number;
  onSpeedChange: (speed: number) => void;
  /** The daily stages of the trek: one "jump" button each. */
  stages: Stage[];
  onJumpToDay: (stage: Stage) => void;
}

/** The button text for each status. */
function labelKey(status: FlythroughStatus): MessageKey {
  if (status === 'playing') return 'fly.pause';
  if (status === 'preparing') return 'fly.preparing';
  if (status === 'paused') return 'fly.resume';
  return 'fly.play'; // idle, finished (starts again), error (try again)
}

/** Play / Pause, an error line if it could not start, Speed, and the jump-to-day buttons. */
export function FlythroughControls({
  controller,
  status,
  distanceM,
  language,
  speed,
  onSpeedChange,
  stages,
  onJumpToDay,
}: FlythroughControlsProps) {
  // Jumps only where the flythrough can fly: not a 0 m stage, and not the way back of an
  // out-and-back trek (the flythrough flies the trail line forwards only; ADR-029).
  const days = stages.filter((stage) => stage.lengthM > 0 && isForwardStage(stage));
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

      <label className="field fly-speed">
        <span>{t('fly.speed', language)}</span>
        <select
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          disabled={!controller}
        >
          {SPEED_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t('fly.speedOption', language, { speed: choice })}
            </option>
          ))}
        </select>
      </label>

      {days.length > 0 && (
        <div className="fly-days" role="group" aria-labelledby="fly-days-label">
          <span id="fly-days-label" className="fly-days-label">
            {t('fly.jumpLabel', language)}
          </span>
          {days.map((stage) => (
            <button
              key={stage.toStopId}
              type="button"
              className="fly-day"
              // Full name for screen readers ("Jump to the start of day 2"); it contains the
              // visible "Day 2", so speech-input users can still say what they see.
              aria-label={t('fly.jumpTo', language, { day: stage.day })}
              disabled={!controller}
              aria-disabled={preparing}
              onClick={() => {
                if (!preparing) onJumpToDay(stage);
              }}
            >
              {t('fly.day', language, { day: stage.day })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
