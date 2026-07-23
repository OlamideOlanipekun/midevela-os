const MAX_RETRIES = 2;
let fallbackReported = false;

function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

export function redisAvailable(): boolean {
  return Boolean(redisUrl() && redisToken());
}

async function redisCommand<T>(command: string, ...args: (string | number)[]): Promise<T | null> {
  if (!redisAvailable()) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${redisUrl()}/${command}/${args.join("/")}`, {
        headers: { Authorization: `Bearer ${redisToken()}` },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) {
        if (!fallbackReported) {
          fallbackReported = true;
          console.error(`redis: ${command} returned ${res.status}`);
        }
        return null;
      }
      if (fallbackReported) {
        fallbackReported = false;
        console.log("redis: recovered");
      }
      const data = await res.json();
      return data?.result ?? null;
    } catch {
      if (attempt < MAX_RETRIES) continue;
      if (!fallbackReported) {
        fallbackReported = true;
        console.error(`redis: ${command} failed after ${MAX_RETRIES + 1} attempts`);
      }
      return null;
    }
  }
  return null;
}

async function pipeline(commands: [string, ...(string | number)[]][]): Promise<any[] | null> {
  if (!redisAvailable()) return null;

  try {
    const res = await fetch(`${redisUrl()}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const redis = {
  async incr(key: string): Promise<number | null> {
    const val = await redisCommand<number>("INCR", key);
    return val;
  },

  async decr(key: string): Promise<number | null> {
    const val = await redisCommand<number>("DECR", key);
    return val;
  },

  async get(key: string): Promise<string | null> {
    return redisCommand<string>("GET", key);
  },

  async set(key: string, value: string | number, ttlSec?: number): Promise<void> {
    if (ttlSec) {
      await pipeline([
        ["SET", key, value],
        ["EXPIRE", key, ttlSec],
      ]);
    } else {
      await redisCommand("SET", key, value);
    }
  },

  async expire(key: string, ttlSec: number): Promise<void> {
    await redisCommand("EXPIRE", key, ttlSec);
  },

  async hincr(key: string, field: string): Promise<number | null> {
    return redisCommand<number>("HINCRBY", key, field, 1);
  },

  async hget(key: string, field: string): Promise<string | null> {
    return redisCommand<string>("HGET", key, field);
  },

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const data = await redisCommand<any[]>("HGETALL", key);
    if (!data) return null;
    const result: Record<string, string> = {};
    for (let i = 0; i < data.length; i += 2) {
      result[data[i]] = data[i + 1];
    }
    return result;
  },

  async pipeline(commands: [string, ...(string | number)[]][]): Promise<any[] | null> {
    return pipeline(commands);
  },
};
