// A minimal insertion-ordered LRU over a Map: `get` refreshes recency, `set`
// evicts the oldest once past `max`. One shared implementation for the two
// unbounded daily caches and the rendered-GIF cache, so a stream of distinct
// keys can't grow memory without bound. No dependency — a Map already keeps
// insertion order, so recency is a delete-then-set.

export class Lru<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly max: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value); // re-insert so it becomes the most recent
    return value;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      // the first key is the oldest — drop it
      this.map.delete(this.map.keys().next().value as K);
    }
  }

  get size(): number {
    return this.map.size;
  }
}
