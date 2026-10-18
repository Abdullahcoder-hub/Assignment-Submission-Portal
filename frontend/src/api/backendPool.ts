export type BackendEntry = {
  url: string;
  enabled: boolean;
  priority: number;
  isPrimary: boolean;
};

export type BackendEvent = {
  type: 'failover' | 'failback' | 'manual';
  fromUrl: string;
  toUrl: string;
  createdAt: string;
};

export type BackendHealth = {
  status: 'unknown' | 'healthy' | 'unhealthy' | 'incompatible';
  lastCheck: string | null;
  lastSuccess: string | null;
  healthySince: number | null;
  consecutiveSuccesses: number;
  failures: number;
  message?: string;
};

export type BackendPoolSnapshot = {
  backends: BackendEntry[];
  health: Record<string, BackendHealth>;
  activeUrl: string;
  events: BackendEvent[];
  poolId: string | null;
  apiCompatibilityVersion: string;
};

type RuntimeConfig = {
  success: boolean;
  backends: BackendEntry[];
  registryConfigured: boolean;
  poolId: string | null;
  apiCompatibilityVersion: string;
};

type HealthResponse = {
  ready?: boolean;
  database?: string;
  poolId?: string | null;
  apiCompatibilityVersion?: string;
};

const CACHE_KEY = 'portal_backend_registry_v1';
const ACTIVE_KEY = 'portal_active_backend_v1';
const EVENTS_KEY = 'portal_backend_events_v1';
const defaultVersion = import.meta.env.VITE_API_COMPATIBILITY_VERSION || 'v1';
const expectedPoolId = import.meta.env.VITE_BACKEND_POOL_ID || null;
const timeoutMs = 4000;
const probeIntervalMs = 20000;
const failbackSuccesses = 3;
const failbackStabilityMs = 60000;
const switchCooldownMs = 60000;

export const normalizeBackendUrl = (value: string): string => {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('Use an HTTPS backend URL.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Backend URL cannot contain credentials, query parameters, or fragments.');
  }
  if (parsed.pathname !== '/' && parsed.pathname.replace(/\/+$/, '') !== '/api') {
    throw new Error('Enter the backend origin only, optionally ending in /api.');
  }
  return parsed.origin;
};

const getApiBase = (url: string): string => `${url}/api`;
const nowIso = (): string => new Date().toISOString();

const readStorage = <T>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Runtime backend discovery can still work without browser storage.
  }
};

const readConfiguredBackends = (): BackendEntry[] => {
  const primary = import.meta.env.VITE_API_URL
    || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://assignment-submission-portal-rfq1.onrender.com/api');
  const additional = (import.meta.env.VITE_BACKEND_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const urls: string[] = [];
  for (const url of [primary, ...additional]) {
    try {
      urls.push(normalizeBackendUrl(url));
    } catch {
      console.error('Ignoring an invalid configured backend URL.');
    }
  }
  if (urls.length === 0) {
    urls.push(import.meta.env.DEV
      ? 'http://localhost:5000'
      : 'https://assignment-submission-portal-rfq1.onrender.com');
  }
  return [...new Set(urls)].map((url, priority) => ({
    url,
    enabled: true,
    priority,
    isPrimary: priority === 0,
  }));
};

class BackendPool {
  private backends = readConfiguredBackends();
  private health = new Map<string, BackendHealth>();
  private activeUrl = this.backends[0]?.url || '';
  private events = readStorage<BackendEvent[]>(EVENTS_KEY) || [];
  private poolId: string | null = expectedPoolId;
  private apiCompatibilityVersion = defaultVersion;
  private listeners = new Set<() => void>();
  private intervalId: number | undefined;
  private lastSwitchAt = 0;
  private eventReporter?: (event: BackendEvent) => void;

  constructor() {
    const cached = readStorage<RuntimeConfig>(CACHE_KEY);
    if (cached?.registryConfigured && cached.backends.length) {
      try {
        this.applyRuntimeConfig(cached, false);
      } catch (error) {
        console.warn('Ignoring an incompatible cached backend registry.', error);
      }
    }
    let savedActive: string | null = null;
    try {
      savedActive = localStorage.getItem(ACTIVE_KEY);
    } catch {
      savedActive = null;
    }
    if (savedActive && this.backends.some((backend) => backend.url === savedActive && backend.enabled)) {
      this.activeUrl = savedActive;
    } else {
      this.activeUrl = this.getPrimary()?.url || this.backends[0]?.url || '';
    }
    if (typeof window !== 'undefined') {
      this.intervalId = window.setInterval(() => void this.checkAll(), probeIntervalMs);
      window.addEventListener('focus', () => void this.checkAll());
      void this.checkAll();
    }
  }

  getSnapshot = (): BackendPoolSnapshot => ({
    backends: [...this.backends].sort((first, second) => first.priority - second.priority),
    health: Object.fromEntries(this.health),
    activeUrl: this.activeUrl,
    events: [...this.events],
    poolId: this.poolId,
    apiCompatibilityVersion: this.apiCompatibilityVersion,
  });

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setEventReporter = (reporter?: (event: BackendEvent) => void): void => {
    this.eventReporter = reporter;
  };

  getApiBaseUrl = (): string => getApiBase(this.activeUrl);

  applyRuntimeConfig = (config: RuntimeConfig, refresh = true): void => {
    if (expectedPoolId && config.poolId !== expectedPoolId) {
      throw new Error('Backend pool does not match this frontend configuration.');
    }
    if (config.apiCompatibilityVersion && config.apiCompatibilityVersion !== defaultVersion) {
      throw new Error('Backend API version does not match this frontend configuration.');
    }
    const backends = config.backends
      .filter((backend) => backend.enabled)
      .map((backend) => ({ ...backend, url: normalizeBackendUrl(backend.url) }))
      .sort((first, second) => first.priority - second.priority);
    if (!backends.length) return;

    this.backends = backends;
    this.poolId = config.poolId || null;
    this.apiCompatibilityVersion = config.apiCompatibilityVersion || defaultVersion;
    writeStorage(CACHE_KEY, config);
    if (!this.backends.some((backend) => backend.url === this.activeUrl)) {
      this.activeUrl = this.getPrimary()?.url || this.backends[0].url;
      this.persistActive();
    }
    this.emit();
    if (refresh) void this.checkAll();
  };

  private getPrimary = (): BackendEntry | undefined =>
    this.backends.find((backend) => backend.enabled && backend.isPrimary);

  private setHealth = (url: string, state: BackendHealth): void => {
    this.health.set(url, state);
    this.emit();
  };

  private initialHealth = (): BackendHealth =>
    this.health.get(this.activeUrl) || {
      status: 'unknown',
      lastCheck: null,
      lastSuccess: null,
      healthySince: null,
      consecutiveSuccesses: 0,
      failures: 0,
    };

  private async probe(url: string): Promise<boolean> {
    const previous = this.health.get(url) || {
      status: 'unknown' as const,
      lastCheck: null,
      lastSuccess: null,
      healthySince: null,
      consecutiveSuccesses: 0,
      failures: 0,
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = await response.json() as HealthResponse;
      const poolMismatch = this.poolId !== null && body.poolId !== this.poolId;
      const missingPoolIdentity = this.backends.length > 1 && (!this.poolId || !body.poolId);
      const versionMismatch = body.apiCompatibilityVersion !== this.apiCompatibilityVersion;
      if (poolMismatch || missingPoolIdentity || versionMismatch) {
        this.setHealth(url, {
          ...previous,
          status: 'incompatible',
          lastCheck: nowIso(),
          failures: previous.failures + 1,
          message: 'Backend pool or API version does not match.',
        });
        return false;
      }
      if (!response.ok || body.ready !== true || body.database !== 'connected') {
        throw new Error('Backend readiness check failed.');
      }
      const time = Date.now();
      const state: BackendHealth = {
        status: 'healthy',
        lastCheck: nowIso(),
        lastSuccess: nowIso(),
        healthySince: previous.status === 'healthy' && previous.healthySince
          ? previous.healthySince
          : time,
        consecutiveSuccesses: previous.consecutiveSuccesses + 1,
        failures: 0,
      };
      this.setHealth(url, state);
      return true;
    } catch (error) {
      const failures = previous.failures + 1;
      this.setHealth(url, {
        ...previous,
        status: failures >= 2 ? 'unhealthy' : previous.status,
        lastCheck: nowIso(),
        failures,
        consecutiveSuccesses: 0,
        healthySince: null,
        message: error instanceof Error ? error.message : 'Health check failed.',
      });
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async refreshRuntimeConfig(): Promise<void> {
    const candidates = [this.activeUrl, ...this.backends.map((backend) => backend.url)]
      .filter((url, index, all) => url && all.indexOf(url) === index);
    for (const url of candidates) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${getApiBase(url)}/runtime/backends`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) continue;
        const config = await response.json() as RuntimeConfig;
        if (
          config.success
          && config.registryConfigured
          && Array.isArray(config.backends)
          && config.backends.length
        ) {
          this.applyRuntimeConfig(config, false);
          return;
        }
      } catch {
        // Other configured backends are attempted in priority order.
      } finally {
        window.clearTimeout(timeout);
      }
    }
  }

  private async checkAll(): Promise<void> {
    await Promise.all(this.backends.filter((backend) => backend.enabled).map((backend) => this.probe(backend.url)));
    await this.refreshRuntimeConfig();
    this.selectHealthyBackend();
    this.tryFailback();
  }

  private selectHealthyBackend(): void {
    const activeHealth = this.health.get(this.activeUrl);
    if (activeHealth?.status !== 'unhealthy' && activeHealth?.status !== 'incompatible') return;
    const candidate = this.backends.find((backend) => backend.enabled && this.health.get(backend.url)?.status === 'healthy');
    if (candidate && candidate.url !== this.activeUrl) this.switchActive(candidate.url, 'failover');
  }

  private tryFailback(): void {
    const primary = this.getPrimary();
    if (!primary || primary.url === this.activeUrl) return;
    const health = this.health.get(primary.url);
    if (
      health?.status === 'healthy'
      && health.consecutiveSuccesses >= failbackSuccesses
      && health.healthySince !== null
      && Date.now() - health.healthySince >= failbackStabilityMs
      && Date.now() - this.lastSwitchAt >= switchCooldownMs
    ) {
      this.switchActive(primary.url, 'failback');
    }
  }

  private switchActive(url: string, type: BackendEvent['type']): void {
    if (url === this.activeUrl) return;
    const fromUrl = this.activeUrl;
    this.activeUrl = url;
    this.lastSwitchAt = Date.now();
    this.persistActive();
    this.recordEvent({ type, fromUrl, toUrl: url, createdAt: nowIso() });
    this.emit();
  }

  private persistActive(): void {
    try {
      localStorage.setItem(ACTIVE_KEY, this.activeUrl);
    } catch {
      // Backend selection remains in memory for this page.
    }
  }

  private recordEvent(event: BackendEvent): void {
    this.events = [event, ...this.events].slice(0, 20);
    writeStorage(EVENTS_KEY, this.events);
    this.eventReporter?.(event);
  }

  async handleRequestFailure(url: string): Promise<void> {
    const first = await this.probe(url);
    if (!first) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      await this.probe(url);
      for (const backend of this.backends) {
        if (!backend.enabled || backend.url === url) continue;
        if (await this.probe(backend.url)) break;
      }
    }
    this.selectHealthyBackend();
  }

  async selectManually(url: string): Promise<void> {
    const normalized = normalizeBackendUrl(url);
    const backend = this.backends.find((candidate) => candidate.url === normalized && candidate.enabled);
    if (!backend) throw new Error('This backend is not enabled in the registry.');
    if (!(await this.probe(normalized))) {
      throw new Error('Backend is not healthy and compatible; it cannot be selected.');
    }
    this.switchActive(normalized, 'manual');
  }

  async testBackend(url: string): Promise<boolean> {
    return this.probe(normalizeBackendUrl(url));
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const backendPool = new BackendPool();
