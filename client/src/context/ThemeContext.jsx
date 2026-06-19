import { createContext, useEffect, useState } from "react";

const STORAGE_KEY = "gymops-theme";

/* Reads any saved preference; falls back to OS-level preference
   on a brand new visit so dark-mode users aren't surprised by a
   bright white dashboard before they've ever touched the toggle. */
function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  const prefersDark = window.matchMedia?.(
    "(prefers-color-scheme: dark)"
  ).matches;
  return prefersDark ? "dark" : "light";
}

const ThemeContext = createContext(undefined);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  /* data-theme on <html> is what every stylesheet's
     [data-theme="dark"] override hooks into */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((current) => (current === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export { ThemeContext, ThemeProvider };