import { useSyncExternalStore } from "react";
import { createValueStore } from "./valueStore";

export type Theme = "light" | "dark";

// the document is already carrying a theme by the time this runs: index.html
// reads the system preference onto the root element before the first paint,
// since a theme applied after react mounts is a theme the page flashes out of.
const root = document.documentElement;

const store = createValueStore<Theme>(root.dataset.theme === "dark" ? "dark" : "light");

// the sheet cuts rather than crossfades, and the movement lives on the switch
// instead: a reveal needs a picture of the page underneath it, and the only ways
// to get one are to photograph the whole sheet or build it twice.
export function setTheme(theme: Theme): void {
  root.classList.add("is-turning");
  root.dataset.theme = theme;
  store.set(theme);

  // a frame late, or the transitions the class is holding off are released while
  // the colours are still the old ones and ease to the new ones after all
  requestAnimationFrame(() => root.classList.remove("is-turning"));
}

export function useTheme(): Theme {
  return useSyncExternalStore(store.subscribe, store.get);
}
