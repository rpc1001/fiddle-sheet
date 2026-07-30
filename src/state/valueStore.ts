// the smallest external store react can subscribe to: one value, one listener
// set. used for anything that changes at pointer or keystroke rate and must not
// re-render the grid.
export type ValueStore<T> = {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
};

export function createValueStore<T>(initial: T): ValueStore<T> {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => current,

    set(next) {
      current = next;
      listeners.forEach((listener) => listener());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
