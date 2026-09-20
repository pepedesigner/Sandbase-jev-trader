/**
 * Seeded PRNG. The whole simulation is deterministic given a seed, so a recorded
 * take can be replayed exactly. mulberry32 is tiny and has a good enough
 * distribution for price shocks and order flow.
 */
export class Rng {
  private s: number;
  /** Cached second Box-Muller variate. */
  private spare: number | null = null;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** Fair coin. */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** Standard normal, via Box-Muller. */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * m;
    return u * m;
  }

  /** Log-normal with the given median and sigma (in log space). Always positive. */
  logNormal(median: number, sigma: number): number {
    return median * Math.exp(this.normal() * sigma);
  }

  /** Poisson by Knuth's method. Small lambdas only, which is all the flow needs. */
  poisson(lambda: number): number {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l);
    return k - 1;
  }

  /** Pick one element. */
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]!;
  }
}
