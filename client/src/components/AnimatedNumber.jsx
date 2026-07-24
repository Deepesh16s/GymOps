import { useEffect, useRef, useState } from "react";

// Counts up (or down) from whatever was last displayed to `value` — 0 on
// first mount, the previous value on any subsequent change — instead of
// snapping straight to the new figure. Purely presentational: callers
// still own the real number and how it's formatted; this just animates
// the transition between two already-computed values.
function AnimatedNumber({ value, format = (n) => String(n), duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return undefined;

    const startValue = startValueRef.current;
    const startTime = performance.now();
    let frameId;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      setDisplay(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        startValueRef.current = value;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return format(Math.round(display));
}

export default AnimatedNumber;
