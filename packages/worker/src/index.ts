import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract } from "tar-stream";
import { PipelineSource } from "node:stream";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import logUpdate from "log-update";
import color from "yoctocolors";

import { parse } from "csv-parse";

import iso_codes from "./lib/ISO-codes-table.json" with { type: "json" };
import { writeFile } from "node:fs/promises";

import { monitorEventLoopDelay, eventLoopUtilization } from "perf_hooks";

// 1. Measure Event Loop Delay (Timer slippage)
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// 2. Measure Event Loop Utilization (Active vs Idle ratio)
let lastELU = eventLoopUtilization();

export const country_codes = iso_codes;

type CsvRow = {
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

type IngestArgs = {
  source: PipelineSource<any>;
  startDate?: Date;
  endDate?: Date;
};

type RowProcessResult = {
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

type WorkerPoolOptions = {
  startTime?: number;
  endTime?: number;
};

const cpus_count = cpus().length;
const isDebug = process.argv.includes("--debug")

const resolveWorkerCount = (): number => {
  const configured = Number(process.env.WORKER_THREADS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  // return Math.max(1, Math.min((cpus().length || 1) - 1, 8));
  return Math.max(1, Math.max((cpus_count || 1) - 1, 2));
};

class RowWorkerPool {
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

export const ingestStationFile = async ({
  source,
  startDate,
  endDate,
}: IngestArgs): Promise<void> => {
  const gunzip = createGunzip();
  const extractor = extract();
  const startTime = startDate?.getTime();
  const endTime = endDate?.getTime();
  let count = 0;
  let errors = 0;
  let saved = 0;
  let skipped = 0;
  let currentFileName = "-";
  const workerCount = resolveWorkerCount();
  const maxPendingJobs = workerCount * 8;
  const workerPool = new RowWorkerPool(workerCount, { startTime, endTime });

  const logProgress = () => {
    const currentELU = eventLoopUtilization(lastELU);
    lastELU = eventLoopUtilization();
    logUpdate(
      `Thread pool: \t${process.env.UV_THREADPOOL_SIZE}\n` +
        `Worker Threads:\t${workerCount}\n` +
        `Pending jobs:\t${workerPool.pendingCount}\n` +
        `CPUs:\t\t${cpus_count}\n` +
        `File Name:\t${currentFileName}\n` +
        `${color.blue(`Count:\t\t${count}`)}` +
        `\n${color.green(`Saved:\t\t${saved}`)}` +
        `\n${color.yellow(`Skipped:\t${skipped}`)}` +
        `\n${color.red(`Errors:\t\t${errors}\n`)}` +
        // `\n//////////////////////////////////\n` +
        `\nEvent Loop Delay (p99): ${histogram.percentile(99) / 1e6} ms\n` +
        `\nEvent Loop Utilization: ${(currentELU.utilization * 100).toFixed(2)}%\n`,
    );
  };

  extractor.on("entry", (headers, stream, next) => {
    count += 1;
    currentFileName = headers.name;
    logProgress();

    let entryFinished = false;
    let parserEnded = false;
    let parserFailed = false;
    let pausedForBackpressure = false;

    const finishEntry = (error?: Error) => {
      if (entryFinished) {
        return;
      }

      entryFinished = true;
      next(error);
    };

    const maybeFinishEntry = () => {
      if (parserFailed || !parserEnded || workerPool.pendingCount > 0) {
        return;
      }

      finishEntry();
    };

    const updateBackpressure = () => {
      const pendingJobs = workerPool.pendingCount;

      if (!pausedForBackpressure && pendingJobs >= maxPendingJobs) {
        pausedForBackpressure = true;
        stream.pause();
        parser.pause();
        return;
      }

      if (pausedForBackpressure && pendingJobs <= workerCount) {
        pausedForBackpressure = false;
        stream.resume();
        parser.resume();
      }
    };

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      autoParse: true,
    });

    parser.on("data", (row: CsvRow) => {
      void workerPool
        .dispatch(row)
        .then((result) => {
          if (result.status === "saved") {
            saved += 1;
          } else {
            skipped += 1;
          }
        })
        .catch((error) => {
          isDebug && console.error({ error });
          errors += 1;
          logProgress();
        })
        .finally(() => {
          updateBackpressure();
          maybeFinishEntry();
        });

      updateBackpressure();
    });

    parser.on("error", function (err) {
      isDebug && console.error({ err });
      errors += 1;
      parserFailed = true;
      logProgress();
      finishEntry(err instanceof Error ? err : new Error(String(err)));
    });

    parser.on("end", () => {
      parserEnded = true;
      maybeFinishEntry();
    });

    stream.on("error", (err) => {
      parserFailed = true;
      finishEntry(err);
    });

    stream.on("data", (chunk: Buffer) => {
      if (parserFailed) {
        return;
      }

      try {
        parser.write(chunk);
      } catch (error) {
        parserFailed = true;
        errors += 1;
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        isDebug && console.error({ err: normalizedError });
        logProgress();
        finishEntry(normalizedError);
      }
    });

    stream.on("end", () => {
      if (parserFailed) {
        return;
      }

      parser.end();
    });
  });

  try {
    await pipeline(source, gunzip, extractor);
    await workerPool.waitForIdle();
  } catch (error) {
    isDebug && console.error({ error });
    logProgress();
  } finally {
    await workerPool.close();
    logUpdate.done();
    await writeFile(
      `status_logs/final_status_${Date.now()}.log`,
      `File Name:\t${currentFileName}\n` +
        `${`Count:\t\t${count}`}` +
        `\n${`Saved:\t\t${saved}`}` +
        `\n${`Skipped:\t${skipped}`}` +
        `\n${`Errors:\t\t${errors}\n`}`,
    );
  }
};
