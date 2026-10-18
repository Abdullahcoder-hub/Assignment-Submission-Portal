import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, CheckCircle, Loader2, Plus, RefreshCw, Save, Server, Trash2 } from 'lucide-react';
import api from '../api/axios';
import {
  backendPool,
  BackendEntry,
  BackendEvent,
  BackendPoolSnapshot,
  normalizeBackendUrl,
} from '../api/backendPool';

type RegistryResponse = BackendPoolSnapshot & { success: boolean; registryConfigured: boolean };

const BackendRegistryPanel: React.FC = () => {
  const snapshot = useSyncExternalStore(backendPool.subscribe, backendPool.getSnapshot);
  const [draft, setDraft] = useState<BackendEntry[]>([]);
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingUrl, setTestingUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.get<RegistryResponse>('/admin/settings/backends');
      setDraft(response.data.backends.map((backend) => ({ ...backend })));
      setEvents(response.data.events || []);
      backendPool.applyRuntimeConfig(response.data);
      setMessage('');
    } catch {
      setMessage('Could not load backend settings. Check that at least one configured service is available.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    backendPool.setEventReporter((event) => {
      void api.post('/admin/settings/backends/events', event).catch(() => {
        console.warn('Backend failover event could not be saved to the registry.');
      });
    });
    return () => backendPool.setEventReporter(undefined);
  }, []);

  const updateDraft = (index: number, patch: Partial<BackendEntry>): void => {
    setDraft((current) => current.map((backend, backendIndex) =>
      backendIndex === index ? { ...backend, ...patch } : backend,
    ));
  };

  const designatePrimary = (index: number): void => {
    setDraft((current) => current.map((backend, backendIndex) => ({
      ...backend,
      isPrimary: index === backendIndex,
      priority: backendIndex,
    })));
  };

  const addBackend = (): void => {
    try {
      const url = normalizeBackendUrl(newUrl);
      if (draft.some((backend) => backend.url === url)) {
        setMessage('That backend is already listed.');
        return;
      }
      setDraft((current) => [
        ...current,
        { url, enabled: true, priority: current.length, isPrimary: current.length === 0 },
      ]);
      setNewUrl('');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enter a valid backend URL.');
    }
  };

  const removeBackend = (index: number): void => {
    setDraft((current) => {
      const next = current.filter((_backend, itemIndex) => itemIndex !== index);
      if (current[index]?.isPrimary && next.length) next[0].isPrimary = true;
      return next.map((backend, priority) => ({ ...backend, priority }));
    });
  };

  const moveBackend = (index: number, direction: -1 | 1): void => {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((backend, priority) => ({ ...backend, priority }));
    });
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      const normalized = draft.map((backend, priority) => ({
        ...backend,
        url: normalizeBackendUrl(backend.url),
        priority,
      }));
      const response = await api.put<RegistryResponse>('/admin/settings/backends', { backends: normalized });
      setDraft(response.data.backends.map((backend) => ({ ...backend })));
      setEvents(response.data.events || events);
      backendPool.applyRuntimeConfig(response.data);
      setMessage('Backend configuration saved.');
    } catch (error) {
      setMessage(
        typeof error === 'object' && error !== null && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not save backend settings.')
          : 'Could not save backend settings.',
      );
    } finally {
      setSaving(false);
    }
  };

  const test = async (url: string): Promise<void> => {
    setTestingUrl(url);
    try {
      const healthy = await backendPool.testBackend(url);
      setMessage(healthy ? 'Backend is healthy and compatible.' : 'Backend is unavailable or incompatible.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not test this backend.');
    } finally {
      setTestingUrl(null);
    }
  };

  const selectManually = async (url: string): Promise<void> => {
    try {
      await backendPool.selectManually(url);
      setMessage('This browser is now using the selected backend.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not select this backend.');
    }
  };

  const visibleEvents = [...events, ...snapshot.events]
    .filter((event, index, all) => all.findIndex((candidate) =>
      candidate.createdAt === event.createdAt && candidate.fromUrl === event.fromUrl && candidate.toUrl === event.toUrl,
    ) === index)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 8);

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Backend Services</h2>
        <p className="mt-1 text-sm text-slate-600">
          The active backend is selected for this browser. Automatic failover retries only safe read requests.
        </p>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-semibold text-blue-900">Currently active: {snapshot.activeUrl || 'None'}</p>
        <p className="mt-1 text-blue-800">
          Pool: {snapshot.poolId || 'not configured'} · API compatibility: {snapshot.apiCompatibilityVersion}
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {message.toLowerCase().includes('healthy') || message.includes('saved')
            ? <CheckCircle className="h-4 w-4 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 text-amber-600" />}
          {message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="space-y-3 p-3 sm:hidden">
          {draft.map((backend, index) => {
            const health = snapshot.health[backend.url];
            return (
              <article key={`${backend.url}-${index}`} className="rounded-xl border border-slate-200 p-3">
                <input
                  value={backend.url}
                  onChange={(event) => updateDraft(index, { url: event.target.value })}
                  className="w-full min-w-0 rounded border border-slate-300 px-2 py-1.5"
                  aria-label="Backend URL"
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="primary-backend-mobile"
                      checked={backend.isPrimary}
                      disabled={!backend.enabled}
                      onChange={() => designatePrimary(index)}
                    />
                    {backend.isPrimary ? 'Primary' : `Backup #${index}`}
                  </label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveBackend(index, -1)} disabled={index === 0} aria-label="Move backend up">↑</button>
                    <button type="button" onClick={() => moveBackend(index, 1)} disabled={index === draft.length - 1} aria-label="Move backend down">↓</button>
                  </div>
                </div>
                <p className="mt-3 text-sm">Health: {health?.status || 'unknown'}</p>
                <p className="text-xs text-slate-500">{health?.message || ''}</p>
                <p className="text-xs text-slate-500">
                  Checked: {health?.lastCheck ? new Date(health.lastCheck).toLocaleString() : 'not checked'}
                </p>
                <p className="text-xs text-slate-600">
                  Last successful check: {health?.lastSuccess ? new Date(health.lastSuccess).toLocaleString() : 'Never'}
                </p>
                <label className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backend.enabled}
                    onChange={(event) => updateDraft(index, { enabled: event.target.checked })}
                    aria-label="Backend enabled"
                  />
                  Enabled
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void test(backend.url)} disabled={testingUrl === backend.url}>Test</button>
                  <button
                    type="button"
                    onClick={() => void selectManually(backend.url)}
                    disabled={!backend.enabled || health?.status !== 'healthy' || snapshot.activeUrl === backend.url}
                  >
                    Use
                  </button>
                  <button type="button" onClick={() => removeBackend(index)} disabled={draft.length === 1}>Remove</button>
                </div>
              </article>
            );
          })}
          {loading && <p className="p-3 text-center text-slate-500">Loading backend registry…</p>}
        </div>
        <table className="hidden w-full min-w-[900px] text-left text-sm sm:table">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Backend URL</th>
              <th className="p-3">Role / Priority</th>
              <th className="p-3">Health</th>
              <th className="p-3">Last successful check</th>
              <th className="p-3">Enabled</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((backend, index) => {
              const health = snapshot.health[backend.url];
              return (
                <tr key={`${backend.url}-${index}`} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <input
                      value={backend.url}
                      onChange={(event) => updateDraft(index, { url: event.target.value })}
                      className="w-full min-w-64 rounded border border-slate-300 px-2 py-1.5"
                      aria-label="Backend URL"
                    />
                  </td>
                  <td className="p-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="primary-backend"
                        checked={backend.isPrimary}
                        disabled={!backend.enabled}
                        onChange={() => designatePrimary(index)}
                      />
                      {backend.isPrimary ? 'Primary' : `Backup #${index}`}
                    </label>
                    <div className="mt-2 flex gap-1">
                      <button type="button" onClick={() => moveBackend(index, -1)} disabled={index === 0} className="rounded border px-2 disabled:opacity-40">↑</button>
                      <button type="button" onClick={() => moveBackend(index, 1)} disabled={index === draft.length - 1} className="rounded border px-2 disabled:opacity-40">↓</button>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                      health?.status === 'healthy' ? 'bg-emerald-100 text-emerald-800'
                        : health?.status === 'unhealthy' || health?.status === 'incompatible'
                          ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {health?.status || 'unknown'}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">{health?.message || ''}</p>
                    <p className="mt-1 text-xs text-slate-500">Checked: {health?.lastCheck ? new Date(health.lastCheck).toLocaleString() : 'not checked'}</p>
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {health?.lastSuccess ? new Date(health.lastSuccess).toLocaleString() : 'Never'}
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={backend.enabled}
                      onChange={(event) => updateDraft(index, { enabled: event.target.checked })}
                      aria-label="Backend enabled"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void test(backend.url)}
                        disabled={testingUrl === backend.url}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        {testingUrl === backend.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={() => void selectManually(backend.url)}
                        disabled={!backend.enabled || health?.status !== 'healthy' || snapshot.activeUrl === backend.url}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                      >
                        Use
                      </button>
                      <button type="button" onClick={() => removeBackend(index)} disabled={draft.length === 1} className="rounded border border-red-200 p-1 text-red-600 disabled:opacity-40" aria-label="Remove backend">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {loading && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading backend registry…</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={newUrl}
          onChange={(event) => setNewUrl(event.target.value)}
          placeholder="https://your-backend.onrender.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={addBackend} className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add backend
        </button>
        <button type="button" onClick={() => void save()} disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><Server className="h-4 w-4" /> Recent failover / failback events</h3>
        {visibleEvents.length === 0
          ? <p className="mt-2 text-sm text-slate-500">No backend switches recorded.</p>
          : <ul className="mt-3 space-y-2">{visibleEvents.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="text-xs text-slate-600">
              {new Date(event.createdAt).toLocaleString()} · {event.type}: {event.fromUrl} → {event.toUrl}
            </li>
          ))}</ul>}
      </div>
    </section>
  );
};

export default BackendRegistryPanel;
