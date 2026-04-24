/**
 * Lua scripts loaded into Redis via EVAL/EVALSHA.
 *
 * Lua scripts execute atomically inside Redis — there is no interleaving
 * with other commands. This eliminates the TOCTOU race that
 * `INCRBY → check → INCRBY -reserve` has under concurrent requests.
 */

/**
 * Atomically reserve `reserve` tokens against a per-user and a global daily
 * ceiling. Both keys are checked and incremented in one Redis tick.
 *
 * KEYS[1] = per-user counter key
 * KEYS[2] = global counter key
 * ARGV[1] = reserve amount (must be > 0)
 * ARGV[2] = per-user budget
 * ARGV[3] = global budget
 * ARGV[4] = TTL seconds (applied on first write of each key)
 *
 * Returns `{ ok, reason, userAfter, globalAfter }`:
 *   - ok = 1 → reservation succeeded; both counters incremented
 *   - ok = 0, reason = "user"   → would exceed user budget; no writes
 *   - ok = 0, reason = "global" → would exceed global budget; no writes
 */
export const RESERVE_AI_TOKENS_SCRIPT = `
local reserve = tonumber(ARGV[1])
local userBudget = tonumber(ARGV[2])
local globalBudget = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local userCur = tonumber(redis.call("GET", KEYS[1]) or "0")
local globalCur = tonumber(redis.call("GET", KEYS[2]) or "0")

if userCur + reserve > userBudget then
  return {0, "user", userCur, globalCur}
end
if globalCur + reserve > globalBudget then
  return {0, "global", userCur, globalCur}
end

local userAfter = redis.call("INCRBY", KEYS[1], reserve)
local globalAfter = redis.call("INCRBY", KEYS[2], reserve)
redis.call("EXPIRE", KEYS[1], ttl)
redis.call("EXPIRE", KEYS[2], ttl)
return {1, "ok", userAfter, globalAfter}
`.trim();

/** Shape of the array returned by RESERVE_AI_TOKENS_SCRIPT. */
export type ReserveAiTokensResult = readonly [
  ok: 0 | 1,
  reason: "ok" | "user" | "global",
  userAfter: number,
  globalAfter: number,
];
