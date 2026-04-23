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

  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<"OK">;

  /** Test-only helpers. */
  __dump(): Record<string, unknown>;
  __reset(): void;
}

function normalizeRedisRangeIndex(
  idx: number,
  len: number,
): number {
  if (len === 0) return 0;
  let i = idx;
  if (i < 0) i = len + i;
  if (i < 0) i = 0;
  if (i >= len) i = len - 1;
  return i;
}

export function createFakeRedis(): FakeRedis {
  const kv = new Map<string, { value: unknown; expiresAt: number | null }>();
  const zsets = new Map<string, ZSetMember[]>();
  const lists = new Map<string, { items: string[]; expiresAt: number | null }>();

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

  function readList(key: string): string[] | null {
    const entry = lists.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      lists.delete(key);
      return null;
    }
    return entry.items;
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
        if (lists.delete(k)) n++;
      }
      return n;
    },
    async expire(key, seconds) {
      const entry = kv.get(key);
      const listEntry = lists.get(key);
      if (entry) {
        entry.expiresAt = Date.now() + seconds * 1000;
        return 1;
      }
      if (listEntry) {
        listEntry.expiresAt = Date.now() + seconds * 1000;
        return 1;
      }
      return 0;
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

    async rpush(key, ...values) {
      let entry = lists.get(key);
      if (!entry || isExpired(entry)) {
        entry = { items: [], expiresAt: null };
        lists.set(key, entry);
      }
      entry.items.push(...values);
      return entry.items.length;
    },

    async lrange(key, start, stop) {
      const items = readList(key);
      if (!items || items.length === 0) return [];
      const len = items.length;
      let s = start;
      let e = stop;
      if (s < 0) s = len + s;
      if (e < 0) e = len + e;
      s = Math.max(0, Math.min(len - 1, s));
      e = Math.max(0, Math.min(len - 1, e));
      if (s > e) return [];
      return items.slice(s, e + 1);
    },

    async ltrim(key, start, stop) {
      const entry = lists.get(key);
      if (!entry || isExpired(entry)) return "OK";
      const len = entry.items.length;
      let s = normalizeRedisRangeIndex(start, len);
      let e = normalizeRedisRangeIndex(stop, len);
      if (s > e) {
        entry.items = [];
      } else {
        entry.items = entry.items.slice(s, e + 1);
      }
      return "OK";
    },

    __dump() {
      return {
        kv: Object.fromEntries(kv.entries()),
        zsets: Object.fromEntries(zsets.entries()),
        lists: Object.fromEntries(lists.entries()),
      };
    },
    __reset() {
      kv.clear();
      zsets.clear();
      lists.clear();
    },
  };
}
