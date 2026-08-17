// Replaces p5's getItem()/storeItem(), which were the only reason the game
// needed a p5 instance alive outside the render loop.
//
// The on-disk format is deliberately p5's: storeItem() wrote
// JSON.stringify(value) under `key`, plus a type marker under
// `key + "p5TypeID"`. Reading `key` back with JSON.parse therefore recovers
// every best lap and ghost lap recorded by the p5 build — players keep their
// records across this migration. The stale type markers are simply left where
// they are; rewriting a key overwrites the value and orphans its marker, which
// costs a few bytes and nothing else.

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Private browsing, a disabled store, or a value written by hand.
    return null;
  }
}

export function storeItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or a disabled store. Losing a best lap is not worth a crash.
  }
}
