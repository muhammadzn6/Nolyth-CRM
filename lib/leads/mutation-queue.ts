export class LeadMutationQueue {
  private queues = new Map<string, Promise<unknown>>();

  private versions = new Map<string, number>();

  async enqueue<T>(leadId: string, task: (version: number) => Promise<T>): Promise<T> {
    const previous = this.queues.get(leadId) ?? Promise.resolve();
    let release = () => {};

    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const version = (this.versions.get(leadId) ?? 0) + 1;
        this.versions.set(leadId, version);
        return task(version);
      })
      .finally(() => {
        release();
      });

    this.queues.set(leadId, Promise.all([run, gate]));

    return run;
  }

  isStale(leadId: string, version: number) {
    return (this.versions.get(leadId) ?? 0) !== version;
  }
}

export function createDebouncer(delayMs: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    schedule(key: string, callback: () => void) {
      const existing = timers.get(key);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        timers.delete(key);
        callback();
      }, delayMs);

      timers.set(key, timer);
    },
    cancel(key: string) {
      const existing = timers.get(key);
      if (existing) {
        clearTimeout(existing);
        timers.delete(key);
      }
    },
    cancelAll() {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
  };
}
