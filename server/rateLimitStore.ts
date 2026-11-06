import { createClient } from '@redis/client';

export interface BucketResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// El reloj de Redis y la actualización atómica evitan carreras entre instancias.
const BUCKET_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000
local capacity = tonumber(ARGV[1])
local perMs = tonumber(ARGV[2]) / 60000
local state = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local tokens = tonumber(state[1]) or capacity
local updated = tonumber(state[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated) * perMs)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updated', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / perMs) * 2)
local retry = 0
if allowed == 0 then retry = math.ceil((1 - tokens) / perMs / 1000) end
return { allowed, math.floor(tokens), retry }
`;

export class LocalBucketStore {
  private buckets = new Map<string, { tokens: number; updated: number; expires: number }>();
  constructor(private readonly clock = Date.now) {}

  consume(key: string, capacity: number, perMinute: number): BucketResult {
    const now = this.clock();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expires <= now) {
      if (this.buckets.size >= 10000) {
        for (const [entry, value] of this.buckets) if (value.expires <= now) this.buckets.delete(entry);
        if (this.buckets.size >= 10000) throw new Error('LOCAL_RATE_LIMIT_CAPACITY');
      }
      bucket = { tokens: capacity, updated: now, expires: now };
    }
    const perMs = perMinute / 60000;
    bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0, now - bucket.updated) * perMs);
    bucket.updated = now;
    bucket.expires = now + Math.ceil(capacity / perMs) * 2;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens--;
    this.buckets.set(key, bucket);
    return { allowed, remaining: Math.floor(bucket.tokens), retryAfterSeconds: allowed ? 0 : Math.ceil((1 - bucket.tokens) / perMs / 1000) };
  }
}

export class SharedRateLimitStore {
  private readonly client: ReturnType<typeof createClient> | undefined;
  private connecting?: Promise<unknown>;
  private readonly local = new LocalBucketStore();

  constructor(readonly url?: string) {
    if (url) {
      this.client = createClient({ url, disableOfflineQueue: true, commandsQueueMaxLength: 1000, socket: { connectTimeout: 1000, reconnectStrategy: false } });
      // Los errores se gestionan por petición; no se registra la URL con credenciales.
      this.client.on('error', () => {});
    }
  }

  async command(args: string[]): Promise<any> {
    if (!this.client) throw new Error('REDIS_NOT_CONFIGURED');
    if (!this.client.isReady) {
      if (!this.connecting) {
        this.connecting = this.client.connect().finally(() => { this.connecting = undefined; });
      }
      await this.connecting;
    }
    return this.client.sendCommand(args, { abortSignal: AbortSignal.timeout(1000) });
  }

  async consume(key: string, capacity: number, perMinute: number): Promise<BucketResult> {
    if (!this.url) return this.local.consume(key, capacity, perMinute);
    const result = await this.command(['EVAL', BUCKET_SCRIPT, '1', key, String(capacity), String(perMinute)]) as number[];
    return { allowed: result[0] === 1, remaining: result[1], retryAfterSeconds: result[2] };
  }

  async close() {
    if (this.client?.isOpen) this.client.destroy();
  }
}
