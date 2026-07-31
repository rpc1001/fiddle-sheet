// the grid keeps the keyboard. without this a control in the title bar would
// take focus on the way down, and the shortcut it stands for would stop working
// the moment you clicked it.
export function keepFocus(event: { preventDefault(): void }): void {
  event.preventDefault();
}
