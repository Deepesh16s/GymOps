import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX } from "lucide-react";
import useCountdown from "../hooks/useCountdown";
import "./RestTimer.css";

const SOUND_PREF_KEY = "gymops_rest_timer_sound";
const PRESETS = [60, 90, 120, 180];

// A short Web Audio beep — no binary asset, no external dependency.
// Fails silently if the browser blocks/lacks AudioContext (e.g. no user
// gesture yet); the timer itself still works without sound.
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Sound is optional — nothing to recover from here.
  }
}

function formatSeconds(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Preset chip label. Rounding every value to the nearest minute (e.g.
// Math.round(90/60)) made 90s and 120s both read as "2m" — this instead
// only abbreviates to "Xm" when the preset is an exact whole minute,
// otherwise spells out the remainder so every preset reads distinctly.
function formatPresetLabel(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// One shared rest timer per workout session (not one per exercise —
// only one rest period is ever active at a time). `restartTrigger`
// changes (a new value, e.g. Date.now()) every time any exercise card
// completes a set; `initialSeconds` is that exercise's default (compound
// vs isolation heuristic, see liveWorkoutEngine.getDefaultRestSeconds),
// always overridable via the preset chips below.
function RestTimer({ initialSeconds, restartTrigger }) {
  const countdown = useCountdown(initialSeconds || 90);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_PREF_KEY) !== "off"
  );
  const hasPlayedRef = useRef(false);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    if (restartTrigger == null) return;
    hasPlayedRef.current = false;
    countdown.start(initialSeconds || 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartTrigger]);

  useEffect(() => {
    if (countdown.isFinished && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      if (soundEnabledRef.current) playBeep();
    }
  }, [countdown.isFinished]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
      return next;
    });
  };

  if (restartTrigger == null) return null;

  return (
    <div className={`rest-timer${countdown.isFinished ? " rest-timer--done" : ""}`}>
      <div className="rest-timer__readout">
        <span className="rest-timer__time">{formatSeconds(countdown.remainingSeconds)}</span>
        <span className="rest-timer__label">
          {countdown.isFinished ? "Rest complete" : "Resting"}
        </span>
      </div>

      <div className="rest-timer__controls">
        {countdown.isRunning ? (
          <button
            type="button"
            className="rest-timer__btn"
            onClick={countdown.pause}
            aria-label="Pause rest timer"
          >
            <Pause size={14} strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            className="rest-timer__btn"
            onClick={countdown.resume}
            disabled={countdown.isFinished}
            aria-label="Resume rest timer"
          >
            <Play size={14} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          className="rest-timer__btn"
          onClick={() => countdown.restart(initialSeconds || 90)}
          aria-label="Restart rest timer"
        >
          <RotateCcw size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="rest-timer__btn"
          onClick={countdown.skip}
          aria-label="Skip rest"
        >
          <SkipForward size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="rest-timer__btn"
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute rest timer sound" : "Unmute rest timer sound"}
        >
          {soundEnabled ? <Volume2 size={14} strokeWidth={2} /> : <VolumeX size={14} strokeWidth={2} />}
        </button>
      </div>

      <div className="rest-timer__presets">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            className="rest-timer__preset-btn"
            onClick={() => countdown.start(sec)}
          >
            {formatPresetLabel(sec)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RestTimer;
