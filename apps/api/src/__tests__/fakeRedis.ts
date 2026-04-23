/**
 * Minimal in-memory Redis fake covering the subset of `@upstash/redis`
 * methods used by the API: get/set/del with TTL, sorted sets (zadd, zrem,
 * zrevrange, zrevrank, zcard), and rate-limit-friendly INCRBY semantics.
 *
 * The shape mirrors `@upstash/redis` so we can pass this fake straight
 * into route factories that expect a `Redis` instance.
 */

interface SetOptions {
  ex?: number;
  px?: number;
  nx?: boolean;
}

interface ZSetMember {
  member: string;
  score: number;
}

export interface FakeRedis {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: SetOptions): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;

  zadd(
    key: string,
    ...args: Array<{ score: number; member: string }>
  ): Promise<number>;
  zrem(key: string, member: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    stop: number,
    opts?: { withScores?: boolean; rev?: boolean },
  ): Promise<string[]>;
  zrevrank(key: string, member: string): Promise<number | null>;
  zcard(key: string): Promise<number>;
  zscore(key: string, member: string): Promise<number | null>;

  incrby(key: string, by: number): Promise<number>;

  /** Test-only helpers. */
  __dump(): Record<string, unknown>;
  __reset(): void;
}

export function createFakeRedis(): FakeRedis {
  const kv = new Map<string, { value: unknown; expiresAt: number | null }>();
  const zsets = new Map<string, ZSetMember[]>();

  function isExpired(entry: { expiresAt: number | null }): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  function readKv(key: string): unknown | null {
    const entry = kv.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      kv.delete(key);
      return null;
    }
    return entry.value;
  }

  return {
    async get<T>(key: string) {
      const v = readKv(key);
      return (v as T | null) ?? null;
    },
    async set(key, value, opts) {
      if (opts?.nx && kv.has(key) && !isExpired(kv.get(key)!)) {
        return null;
      }
      const ttl = opts?.ex
        ? opts.ex * 1000
        : opts?.px
          ? opts.px
          : null;
      kv.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl : null,
      });
      return "OK";
    },
    async del(...keys) {
      let n = 0;
      for (const k of keys) {
        if (kv.delete(k)) n++;
        if (zsets.delete(k)) n++;
      }
      return n;
    },
    async expire(key, seconds) {
      const entry = kv.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },

    async zadd(key, ...args) {
      const set = zsets.get(key) ?? [];
      let added = 0;
      for (const { score, member } of args) {
        const idx = set.findIndex((m) => m.member === member);
        if (idx === -1) {
          set.push({ score, member });
          added++;
        } else {
          set[idx].score = score;
        }
      }
      zsets.set(key, set);
      return added;
    },
    async zrem(key, member) {
      const set = zsets.get(key);
      if (!set) return 0;
      const idx = set.findIndex((m) => m.member === member);
      if (idx === -1) return 0;
      set.splice(idx, 1);
      return 1;
    },
    async zrange(key, start, stop, opts) {
      const direction = opts?.rev ? -1 : 1;
      const set = (zsets.get(key) ?? []).slice().sort((a, b) => {
        if (a.score === b.score) return a.member.localeCompare(b.member);
        return direction * (a.score - b.score);
      });
      // Negative stops mean "until the end" in Redis semantics.
      const realStop = stop < 0 ? set.length + stop : stop;
      const slice = set.slice(start, realStop + 1);
      if (opts?.withScores) {
        return slice.flatMap((m) => [m.member, String(m.score)]);
      }
      return slice.map((m) => m.member);
    },
    async zrevrank(key, member) {
      const set = (zsets.get(key) ?? []).slice().sort((a, b) => {
        if (a.score === b.score) return a.member.localeCompare(b.member);
        return b.score - a.score;
      });
      const idx = set.findIndex((m) => m.member === member);
      return idx === -1 ? null : idx;
    },
    async zcard(key) {
      return zsets.get(key)?.length ?? 0;
    },
    async zscore(key, member) {
      const m = zsets.get(key)?.find((x) => x.member === member);
      return m ? m.score : null;
    },

    async incrby(key, by) {
      const entry = kv.get(key);
      const cur = Number(readKv(key) ?? 0);
      const next = cur + by;
      kv.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
      return next;
    },

    __dump() {
      return {
        kv: Object.fromEntries(kv.entries()),
        zsets: Object.fromEntries(zsets.entries()),
      };
    },
    __reset() {
      kv.clear();
      zsets.clear();
    },
  };
}
