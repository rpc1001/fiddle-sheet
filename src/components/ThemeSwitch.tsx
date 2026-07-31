import { useState } from "react";
import { setTheme, useTheme } from "../state/theme";
import "./ThemeSwitch.css";
import { keepFocus } from "./keepFocus";

// drawn rather than typed, for the same reason as the step arrows: neither of
// these is in the two fonts, so as text they arrive in whatever the system has
function Sun() {
  return (
    <svg className="theme-icon is-light" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 3.3V1.5M8 12.7V14.5M3.3 8H1.5M12.7 8H14.5M4.68 4.68 3.4 3.4M11.32 4.68 12.6 3.4M4.68 11.32 3.4 12.6M11.32 11.32 12.6 12.6" />
    </svg>
  );
}

function Moon() {
  return (
    <svg className="theme-icon is-dark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53z" />
    </svg>
  );
}

export function ThemeSwitch() {
  const dark = useTheme() === "dark";
  // the press is held here rather than read from :active. the mousedown that
  // keeps the grid's focus is prevented, and preventing it also cancels the
  // active state, which is the whole give of the button.
  const [pressed, setPressed] = useState(false);

  // on click rather than on the pointer coming up, so the space bar still works it
  function flip(): void {
    setTheme(dark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      role="switch"
      className={pressed ? "theme-switch is-pressed" : "theme-switch"}
      aria-label="dark mode"
      aria-checked={dark}
      onMouseDown={keepFocus}
      onClick={flip}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {/* under the icons rather than around them: the thumb is the only part
          that moves, and the two faces stay where they are to be moved between */}
      <span className="theme-thumb" />
      <Sun />
      <Moon />
    </button>
  );
}
