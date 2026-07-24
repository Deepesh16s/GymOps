import { useState, useEffect, useRef, useCallback } from "react";

// Generic pause/resume/skip/restart countdown. Uses the same
// setInterval + Date.now() diffing idiom WorkoutSession's elapsed-time
// clock already uses for its up-counter, so drift behaves identically —
// but this counts down and supports pausing, which that one-way clock
// never needed.
function useCountdown(initialSeconds) {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [remainingMs, setRemainingMs] = useState(initialSeconds * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const endTimeRef = useRef(null);
  const pausedRemainingRef = useRef(initialSeconds * 1000);

  useEffect(() => {
    if (!isRunning) return undefined;

    const interval = setInterval(() => {
      const msLeft = Math.max(0, endTimeRef.current - Date.now());
      setRemainingMs(msLeft);
      if (msLeft <= 0) setIsRunning(false);
    }, 200);

    return () => clearInterval(interval);
  }, [isRunning]);

  const start = useCallback((seconds) => {
    const duration = seconds != null ? seconds : totalSeconds;
    setTotalSeconds(duration);
    pausedRemainingRef.current = duration * 1000;
    endTimeRef.current = Date.now() + duration * 1000;
    setRemainingMs(duration * 1000);
    setIsRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = useCallback(() => {
    setIsRunning((running) => {
      if (!running) return running;
      pausedRemainingRef.current = Math.max(0, endTimeRef.current - Date.now());
      return false;
    });
  }, []);

  const resume = useCallback(() => {
    if (pausedRemainingRef.current <= 0) return;
    endTimeRef.current = Date.now() + pausedRemainingRef.current;
    setIsRunning(true);
  }, []);

  const restart = useCallback(
    (seconds) => start(seconds != null ? seconds : totalSeconds),
    [start, totalSeconds]
  );

  const skip = useCallback(() => {
    setIsRunning(false);
    setRemainingMs(0);
  }, []);

  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isRunning,
    isFinished: remainingMs <= 0,
    start,
    pause,
    resume,
    restart,
    skip,
  };
}

export default useCountdown;
