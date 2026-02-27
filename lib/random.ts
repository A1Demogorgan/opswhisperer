export function seeded(seed: number) {
  let s = seed >>> 0;
  return {
    next() {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    },
    int(min: number, max: number) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(list: T[]): T {
      return list[this.int(0, list.length - 1)];
    },
  };
}
