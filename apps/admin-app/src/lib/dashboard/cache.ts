interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return Promise.resolve(existing.data as T);
  }
  return fn().then((data) => {
    store.set(key, { data, expiresAt: Date.now() + ttlSec * 1000 });
    return data;
  });
}

export function invalidateCache(keyPattern?: string): void {
  if (!keyPattern) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(keyPattern)) {
      store.delete(key);
    }
  }
}
