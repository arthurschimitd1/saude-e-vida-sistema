// Cache transitório apenas em memória. Nunca persiste indicadores ou tokens.
export type ResourceState<T> = { data: T | null; error: unknown; loading: boolean; updatedAt: number };
const EMPTY: ResourceState<never> = Object.freeze({ data: null, error: null, loading: false, updatedAt: 0 });
type Entry<T> = { state: ResourceState<T>; controller?: AbortController; pending?: Promise<void> };

export class SessionResourceCache {
  private session = '';
  private entries = new Map<string, Entry<unknown>>();
  private listeners = new Set<() => void>();
  constructor(private maxEntries = 12, private clock = () => Date.now()) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  read<T>(session: string, key: string): ResourceState<T> {
    return (session === this.session ? this.entries.get(key)?.state : null) as ResourceState<T> ?? EMPTY;
  }
  clear() {
    this.entries.forEach(entry => entry.controller?.abort());
    this.entries.clear(); this.session = ''; this.emit();
  }
  setSession(session: string) { if (session !== this.session) { this.clear(); this.session = session; } }
  async load<T>(session: string, key: string, fetcher: (signal: AbortSignal) => Promise<T>, ttl: number, force = false) {
    this.setSession(session);
    let entry = this.entries.get(key) as Entry<T> | undefined;
    if (entry?.pending) return entry.pending;
    if (!force && entry?.state.data && this.clock() - entry.state.updatedAt < ttl) return;
    if (!entry) {
      if (this.entries.size >= this.maxEntries) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) { this.entries.get(oldest)?.controller?.abort(); this.entries.delete(oldest); }
      }
      entry = { state: EMPTY }; this.entries.set(key, entry);
    }
    const current = entry;
    const controller = new AbortController(); current.controller = controller;
    current.state = { ...current.state, error: null, loading: true };
    // A promise é publicada antes de notificar assinantes: menu e página deduplicam.
    current.pending = Promise.resolve().then(() => fetcher(controller.signal)).then(data => {
      if (controller.signal.aborted || session !== this.session || this.entries.get(key) !== current) return;
      current.state = { data, error: null, loading: false, updatedAt: this.clock() };
    }).catch(error => {
      if (controller.signal.aborted || session !== this.session || this.entries.get(key) !== current) return;
      const status = (error as { status?: number })?.status;
      const denied = status === 401 || status === 403 || status === 404;
      current.state = { ...current.state, data: denied ? null : current.state.data, error, loading: false };
    }).finally(() => { current.pending = undefined; if (!controller.signal.aborted) this.emit(); });
    this.emit(); return current.pending;
  }
}

export const contextCache = new SessionResourceCache(1);
export const overviewCache = new SessionResourceCache(8);
export const emptyResource = <T,>(): ResourceState<T> => EMPTY;

