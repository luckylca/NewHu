import type { ProductV1DomainMatch } from './domainSelection';

export type ProductV1DomainClassificationPriority = 'high' | 'normal' | 'low';

type DomainTask = {
  key: string;
  priority: ProductV1DomainClassificationPriority;
  sequence: number;
  started: boolean;
  canceled: boolean;
  consumers: number;
  work: () => Promise<ProductV1DomainMatch[]>;
  promise: Promise<ProductV1DomainMatch[]>;
  resolve: (value: ProductV1DomainMatch[]) => void;
  reject: (reason: unknown) => void;
};

const PRIORITY_RANK: Record<ProductV1DomainClassificationPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export class ProductV1DomainTaskQueue {
  private readonly jobs = new Map<string, DomainTask>();
  private readonly queued: DomainTask[] = [];
  private sequence = 0;
  private running = false;
  private pumpTimer: ReturnType<typeof setTimeout> | null = null;

  enqueue(
    key: string,
    priority: ProductV1DomainClassificationPriority,
    work: () => Promise<ProductV1DomainMatch[]>,
    signal?: AbortSignal,
  ) {
    let job = this.jobs.get(key);
    if (!job) {
      let resolve!: (value: ProductV1DomainMatch[]) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<ProductV1DomainMatch[]>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
      });
      // A job can lose every consumer before it starts. Keep its rejection handled
      // even if no subscriber remains to observe the underlying shared promise.
      void promise.catch(() => undefined);

      job = {
        key,
        priority,
        sequence: this.sequence++,
        started: false,
        canceled: false,
        consumers: 0,
        work,
        promise,
        resolve,
        reject,
      };
      this.jobs.set(key, job);
      this.queued.push(job);
      this.schedulePump();
    } else if (PRIORITY_RANK[priority] < PRIORITY_RANK[job.priority]) {
      job.priority = priority;
    }

    if (!job.started && job.canceled) job.canceled = false;
    return this.subscribe(job, signal);
  }

  private subscribe(job: DomainTask, signal?: AbortSignal) {
    job.consumers += 1;

    return new Promise<ProductV1DomainMatch[]>((resolve, reject) => {
      let active = true;

      const finishConsumer = () => {
        if (!active) return false;
        active = false;
        job.consumers = Math.max(0, job.consumers - 1);
        if (job.consumers === 0 && !job.started) job.canceled = true;
        if (signal) signal.removeEventListener('abort', onAbort);
        return true;
      };

      const onAbort = () => {
        if (!finishConsumer()) return;
        resolve([]);
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });

      job.promise.then(
        (value) => {
          if (!finishConsumer()) return;
          resolve(value);
        },
        (error) => {
          if (!finishConsumer()) return;
          reject(error);
        },
      );
    });
  }

  private schedulePump() {
    if (this.running || this.pumpTimer) return;
    // Batch requests produced by one React effect/layout turn so visible high
    // priority work can overtake speculative low-priority pre-render work.
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = null;
      void this.run();
    }, 0);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queued.length > 0) {
        this.queued.sort((a, b) => (
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
          || a.sequence - b.sequence
        ));
        const job = this.queued.shift()!;
        if (job.canceled || job.consumers === 0) {
          job.resolve([]);
          if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
          continue;
        }

        job.started = true;
        try {
          job.resolve(await job.work());
        } catch (error) {
          job.reject(error);
        } finally {
          if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
        }
      }
    } finally {
      this.running = false;
      if (this.queued.length > 0) this.schedulePump();
    }
  }
}
