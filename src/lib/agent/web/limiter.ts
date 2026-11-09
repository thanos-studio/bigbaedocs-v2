import 'server-only';

const MAX_QUEUE_WAIT_MS = 8_000;
const POLL_MS = 100;
const DEFAULT_COOLDOWN_SECONDS = 60;
/** 서버가 알려주는 재시도 시간이 비정상적으로 길어도, 이 이상은 막아 두지 않는다(일일 한도는 예외로 별도 처리). */
const MAX_COOLDOWN_SECONDS = 24 * 60 * 60;

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 제공자별 호출 관문.
 * - 분당 요청 수와 동시 실행 수를 지킨다(Firecrawl: 무료 /scrape·/search 10회/분, 동시 브라우저 2개).
 * - 429 를 받으면 cooldown 으로 일정 시간 문을 닫아, 그동안은 기다리지 않고 바로 다른 제공자로 넘어가게 한다.
 */
export class ProviderGate {
  private stamps: number[] = [];
  private active = 0;
  private cooldownUntil = 0;

  constructor(
    readonly name: string,
    private readonly perMinute: number,
    private readonly concurrency: number
  ) {}

  cooldownLeftSeconds(): number {
    return Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000));
  }

  /** 서버가 429 로 알려준 시간만큼 문을 닫는다. */
  cooldown(seconds: number | undefined): number {
    const wait = Math.min(Math.max(seconds ?? DEFAULT_COOLDOWN_SECONDS, 1), MAX_COOLDOWN_SECONDS);
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + wait * 1000);
    return wait;
  }

  private async acquire(): Promise<void> {
    const startedAt = Date.now();

    for (;;) {
      const left = this.cooldownLeftSeconds();
      if (left > 0) throw new RateLimitError(`${this.name} 요청 한도에 걸려 ${left}초 뒤에 다시 시도할 수 있어요.`, left);

      const now = Date.now();
      this.stamps = this.stamps.filter((stamp) => now - stamp < 60_000);

      if (this.active < this.concurrency && this.stamps.length < this.perMinute) {
        this.stamps.push(now);
        this.active += 1;
        return;
      }

      if (now - startedAt + POLL_MS > MAX_QUEUE_WAIT_MS) {
        const retry = this.stamps.length >= this.perMinute ? Math.ceil((60_000 - (now - this.stamps[0])) / 1000) : 2;
        throw new RateLimitError(`${this.name} 요청이 몰려 있어요.`, Math.max(retry, 1));
      }

      await sleep(POLL_MS);
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.active -= 1;
    }
  }
}

// Next dev 의 HMR 이 모듈을 다시 불러도 한도 기록이 초기화되지 않게 전역에 둔다.
const registry = globalThis as typeof globalThis & { __bigbaeWebGates?: Map<string, ProviderGate> };

export function getGate(name: string, perMinute: number, concurrency: number): ProviderGate {
  registry.__bigbaeWebGates ??= new Map();
  let gate = registry.__bigbaeWebGates.get(name);
  if (!gate) {
    gate = new ProviderGate(name, perMinute, concurrency);
    registry.__bigbaeWebGates.set(name, gate);
  }
  return gate;
}

/**
 * 제공자 응답에서 "한도 초과"를 알아본다.
 * Firecrawl 키리스 한도는 HTTP 429 가 아니라 툴 오류(KEYLESS_QUOTA_EXHAUSTED / KEYLESS_LIMIT_REACHED)로 오고,
 * 재시도 시간은 retryAfterSeconds / retry_after_seconds 에 담겨 온다.
 */
export function detectRateLimit(text: string): { hit: boolean; retryAfterSeconds?: number; daily: boolean } {
  const hit = /KEYLESS_(?:QUOTA_EXHAUSTED|LIMIT_REACHED)|INDEX_DAILY_LIMIT|rate.?limit|too many requests|\b429\b/i.test(text);
  if (!hit) return { hit: false, daily: false };

  const seconds = /retry[_-]?after[_a-z]*["']?\s*[:=]\s*(\d+)/i.exec(text)?.[1];
  return {
    hit: true,
    retryAfterSeconds: seconds === undefined ? undefined : Number(seconds),
    daily: /QUOTA_EXHAUSTED|DAILY_LIMIT|daily/i.test(text),
  };
}
