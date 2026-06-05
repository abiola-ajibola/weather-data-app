import { Worker } from "node:worker_threads";

export type CsvRow = {
  STATION?: string;
  DATE?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
  ELEVATION?: string;
  NAME?: string;
  PRCP?: string;
  PRCP_ATTRIBUTES?: string;
  TAVG?: string;
  TAVG_ATTRIBUTES?: string;
  TMAX?: string;
  TMAX_ATTRIBUTES?: string;
  TMIN?: string;
  TMIN_ATTRIBUTES?: string;
  DAPR?: string;
  DAPR_ATTRIBUTES?: string;
  DATN?: string;
  DATN_ATTRIBUTES?: string;
  DATX?: string;
  DATX_ATTRIBUTES?: string;
  DWPR?: string;
  DWPR_ATTRIBUTES?: string;
  MDPR?: string;
  MDPR_ATTRIBUTES?: string;
  MDTN?: string;
  MDTN_ATTRIBUTES?: string;
  MDTX?: string;
  MDTX_ATTRIBUTES?: string;
};

export type RowProcessResult = {
  status: "saved" | "skipped";
};

type RowProcessRequest = {
  id: number;
  row: CsvRow;
};

type RowProcessResponse = {
  id: number;
  result?: RowProcessResult;
  error?: string;
};

type PendingJob = {
  id: number;
  row: CsvRow;
  resolve: (result: RowProcessResult) => void;
  reject: (error: unknown) => void;
};

type PoolWorkerState = {
  worker: Worker | null;
  busy: boolean;
  currentJobId?: number;
};

export type WorkerPoolOptions = {
  startTime?: number;
  endTime?: number;
};

export class RowWorkerPool {
  private readonly workers: PoolWorkerState[] = [];
  private readonly queue: PendingJob[] = [];
  private readonly pendingJobs = new Map<number, PendingJob>();
  private readonly idleResolvers: Array<() => void> = [];
  private readonly workerScriptUrl: URL;
  private nextJobId = 1;
  private isClosed = false;

  constructor(
    private readonly workerCount: number,
    private readonly options: WorkerPoolOptions,
  ) {
    const usesTsxLoader = process.execArgv.some((arg) => arg.includes("tsx"));
    const workerFile = usesTsxLoader
      ? "./row-processor.worker.ts"
      : "./row-processor.worker.js";

    this.workerScriptUrl = new URL(workerFile, import.meta.url);

    for (let index = 0; index < this.workerCount; index++) {
      this.workers.push(this.createWorkerState());
    }
  }

  get pendingCount(): number {
    return this.queue.length + this.pendingJobs.size;
  }

  dispatch(row: CsvRow): Promise<RowProcessResult> {
    if (this.isClosed) {
      return Promise.reject(new Error("Worker pool has already been closed."));
    }

    return new Promise<RowProcessResult>((resolve, reject) => {
      this.queue.push({ id: this.nextJobId++, row, resolve, reject });
      this.schedule();
    });
  }

  waitForIdle(): Promise<void> {
    if (this.pendingCount === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    const closedError = new Error("Worker pool closed before jobs completed.");

    while (this.queue.length > 0) {
      const queuedJob = this.queue.shift();
      queuedJob?.reject(closedError);
    }

    for (const pendingJob of this.pendingJobs.values()) {
      pendingJob.reject(closedError);
    }
    this.pendingJobs.clear();

    const terminations: Array<Promise<number>> = [];
    for (const workerState of this.workers) {
      const worker = workerState.worker;
      workerState.worker = null;
      workerState.busy = false;
      workerState.currentJobId = undefined;

      if (!worker) {
        continue;
      }

      worker.removeAllListeners();
      terminations.push(worker.terminate());
    }

    await Promise.allSettled(terminations);
    this.resolveIdleWaitersIfNeeded();
  }

  private createWorkerState(): PoolWorkerState {
    const workerState: PoolWorkerState = {
      worker: null,
      busy: false,
      currentJobId: undefined,
    };
    workerState.worker = this.spawnWorker(workerState);
    return workerState;
  }

  private spawnWorker(workerState: PoolWorkerState): Worker {
    const worker = new Worker(this.workerScriptUrl, {
      execArgv: process.execArgv,
      workerData: {
        startTime: this.options.startTime ?? null,
        endTime: this.options.endTime ?? null,
      },
    });

    worker.on("message", (message: RowProcessResponse) => {
      if (workerState.worker !== worker || this.isClosed) {
        return;
      }

      this.handleWorkerMessage(workerState, message);
    });

    worker.on("error", (error) => {
      if (workerState.worker !== worker || this.isClosed) {
        return;
      }

      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.handleWorkerFailure(workerState, normalizedError);
    });

    worker.on("exit", (code) => {
      if (workerState.worker !== worker || this.isClosed) {
        return;
      }

      if (code !== 0) {
        this.handleWorkerFailure(
          workerState,
          new Error(`Row worker exited unexpectedly with code ${code}.`),
        );
      }
    });

    return worker;
  }

  private handleWorkerMessage(
    workerState: PoolWorkerState,
    message: RowProcessResponse,
  ) {
    const job = this.pendingJobs.get(message.id);
    if (!job) {
      return;
    }

    this.pendingJobs.delete(message.id);
    workerState.busy = false;
    workerState.currentJobId = undefined;

    if (message.error) {
      job.reject(new Error(message.error));
    } else if (message.result) {
      job.resolve(message.result);
    } else {
      job.reject(new Error("Row worker returned no result."));
    }

    this.schedule();
    this.resolveIdleWaitersIfNeeded();
  }

  private handleWorkerFailure(
    workerState: PoolWorkerState,
    error: Error,
  ): void {
    const failedJobId = workerState.currentJobId;

    if (failedJobId !== undefined) {
      const failedJob = this.pendingJobs.get(failedJobId);
      if (failedJob) {
        this.pendingJobs.delete(failedJobId);
        failedJob.reject(error);
      }
    }

    workerState.busy = false;
    workerState.currentJobId = undefined;

    const failedWorker = workerState.worker;
    workerState.worker = null;

    failedWorker?.removeAllListeners();

    if (!this.isClosed) {
      workerState.worker = this.spawnWorker(workerState);
      this.schedule();
      this.resolveIdleWaitersIfNeeded();
    }
  }

  private schedule(): void {
    if (this.isClosed) {
      return;
    }

    for (const workerState of this.workers) {
      if (workerState.busy) {
        continue;
      }

      const worker = workerState.worker;
      const nextJob = this.queue.shift();

      if (!worker || !nextJob) {
        continue;
      }

      workerState.busy = true;
      workerState.currentJobId = nextJob.id;
      this.pendingJobs.set(nextJob.id, nextJob);

      worker.postMessage({
        id: nextJob.id,
        row: nextJob.row,
      } satisfies RowProcessRequest);
    }
  }

  private resolveIdleWaitersIfNeeded(): void {
    if (this.pendingCount !== 0 || this.idleResolvers.length === 0) {
      return;
    }

    const resolvers = this.idleResolvers.splice(0, this.idleResolvers.length);
    for (const resolve of resolvers) {
      resolve();
    }
  }
}