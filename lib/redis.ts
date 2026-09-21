type RedisResult<T> = { result?: T; error?: string };

function credentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL
    || process.env.KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function isPersistentStorageReady() {
  return Boolean(credentials());
}

export async function redisCommand<T = unknown>(...command: Array<string | number>) {
  const config = credentials();
  if (!config) throw new Error("Persistent account storage is not configured");
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });
  const payload = await response.json() as RedisResult<T>;
  if (!response.ok || payload.error) throw new Error(payload.error || "Persistent storage request failed");
  return payload.result as T;
}

export async function readJson<T>(key: string) {
  const value = await redisCommand<string | null>("GET", key);
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export async function writeJson(key: string, value: unknown, ttlSeconds?: number) {
  const command: Array<string | number> = ["SET", key, JSON.stringify(value)];
  if (ttlSeconds) command.push("EX", ttlSeconds);
  return redisCommand<string | null>(...command);
}
