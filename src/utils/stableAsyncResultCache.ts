/** Share one immutable async result per key across remounts and later requests. */
export class StableAsyncResultCache<T> {
  private readonly results = new Map<string, T>();
  private readonly requests = new Map<string, Promise<T>>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    if (this.results.has(key)) {
      const cached = this.results.get(key)!;
      this.results.delete(key);
      this.results.set(key, cached);
      return Promise.resolve(cached);
    }

    const pending = this.requests.get(key);
    if (pending) return pending;

    const request = Promise.resolve()
      .then(load)
      .then((value) => {
        this.results.delete(key);
        this.results.set(key, value);
        while (this.results.size > this.maxEntries) {
          const oldest = this.results.keys().next().value;
          if (oldest == null) break;
          this.results.delete(oldest);
        }
        return value;
      })
      .finally(() => {
        this.requests.delete(key);
      });
    this.requests.set(key, request);
    return request;
  }
}
