import BackendRegistry, { IRegisteredBackend } from '../models/BackendRegistry.js';

const registryId = 'backend-registry';
const maxBackends = 10;

export const normalizeBackendUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Enter a backend URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid backend URL, such as https://backend.example.com.');
  }
  const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && isLocal && parsed.protocol === 'http:')) {
    throw new Error('Backend URLs must use HTTPS.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Backend URLs cannot contain credentials, query parameters, or fragments.');
  }
  if (parsed.pathname !== '/' && parsed.pathname.replace(/\/+$/, '') !== '/api') {
    throw new Error('Enter the backend origin only, optionally ending in /api.');
  }
  return parsed.origin;
};

const getDefaultBackend = (): IRegisteredBackend[] => {
  const configuredUrl = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL;
  if (!configuredUrl) return [];
  return [{
    url: normalizeBackendUrl(configuredUrl),
    enabled: true,
    priority: 0,
    isPrimary: true,
  }];
};

export const loadBackendRegistry = async () => {
  const registry = await BackendRegistry.findById(registryId).exec();
  return {
    backends: registry?.backends || getDefaultBackend(),
    events: registry?.events || [],
    registryConfigured: Boolean(registry),
    poolId: process.env.BACKEND_POOL_ID || null,
    apiCompatibilityVersion: process.env.API_COMPATIBILITY_VERSION || 'v1',
  };
};

export const validateBackendList = (input: unknown): IRegisteredBackend[] => {
  if (!Array.isArray(input) || input.length < 1 || input.length > maxBackends) {
    throw new Error(`Configure between 1 and ${maxBackends} backend services.`);
  }

  const backends = input.map((item): IRegisteredBackend => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Each backend configuration must be an object.');
    }
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.enabled !== 'boolean' || typeof candidate.isPrimary !== 'boolean') {
      throw new Error('Each backend must have valid enabled and primary settings.');
    }
    if (typeof candidate.priority !== 'number' || !Number.isSafeInteger(candidate.priority) || candidate.priority < 0) {
      throw new Error('Backend priorities must be non-negative integers.');
    }
    return {
      url: normalizeBackendUrl(candidate.url),
      enabled: candidate.enabled,
      priority: candidate.priority,
      isPrimary: candidate.isPrimary,
    };
  });

  const uniqueUrls = new Set(backends.map((backend) => backend.url));
  if (uniqueUrls.size !== backends.length) {
    throw new Error('Backend URLs must be unique.');
  }
  if (new Set(backends.map((backend) => backend.priority)).size !== backends.length) {
    throw new Error('Each backend must have a unique priority.');
  }
  if (backends.filter((backend) => backend.isPrimary).length !== 1) {
    throw new Error('Select exactly one primary backend.');
  }
  if (backends.some((backend) => backend.isPrimary && !backend.enabled)) {
    throw new Error('The primary backend must be enabled.');
  }
  if (backends.filter((backend) => backend.enabled).length === 0) {
    throw new Error('At least one backend must be enabled.');
  }

  return backends.sort((first, second) => first.priority - second.priority);
};

export const saveBackendList = async (backends: IRegisteredBackend[]) => {
  const registry = await BackendRegistry.findByIdAndUpdate(
    registryId,
    { $set: { backends } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec();
  return registry?.backends || backends;
};

export const recordBackendEvent = async (
  event: { type: 'failover' | 'failback' | 'manual'; fromUrl: string; toUrl: string },
): Promise<void> => {
  await BackendRegistry.findByIdAndUpdate(
    registryId,
    {
      $push: {
        events: {
          $each: [{ ...event, createdAt: new Date() }],
          $slice: -50,
        },
      },
    },
  );
};
