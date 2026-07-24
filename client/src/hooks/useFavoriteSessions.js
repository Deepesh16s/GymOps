import { useCallback, useEffect, useState } from "react";

// Workout History 2.0. Favorite is a purely client-side preference (no
// backend field exists for it) — persisted the same way the Workout
// Session Editing discovery-tip flags are (a plain localStorage key),
// so a favorited session survives reloads without needing a schema
// change. Session keys (`session:<sessionId>` / `standalone:<workoutId>`)
// are already stable identifiers from workoutUtils.groupWorkoutsIntoSessions.
const STORAGE_KEY = "gymops_favorite_session_keys";

const loadFavoriteKeys = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

function useFavoriteSessions() {
  const [favoriteKeys, setFavoriteKeys] = useState(() => new Set(loadFavoriteKeys()));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favoriteKeys)));
    } catch (error) {
      console.log(error);
    }
  }, [favoriteKeys]);

  const isFavorite = useCallback((key) => favoriteKeys.has(key), [favoriteKeys]);

  const toggleFavorite = useCallback((key) => {
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { favoriteKeys, isFavorite, toggleFavorite };
}

export default useFavoriteSessions;
