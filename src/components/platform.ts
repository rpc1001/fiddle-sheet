const MAC = navigator.userAgent.includes("Mac");

// isChord in Grid.tsx accepts meta or ctrl, so only the way the modifier is
// written changes here, never which keys work
export function chordLabel(key: string): string {
  return MAC ? `⌘${key}` : `Ctrl ${key}`;
}
