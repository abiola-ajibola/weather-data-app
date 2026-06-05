import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract } from "tar-stream";
import { PipelineSource } from "node:stream";
import { cpus } from "node:os";
import logUpdate from "log-update";
import color from "yoctocolors";

import { parse } from "csv-parse";

import iso_codes from "./lib/ISO-codes-table.json" with { type: "json" };
import { RowWorkerPool, type CsvRow } from "./row-worker-pool.js";
import { mkdir, writeFile } from "node:fs/promises";

import { monitorEventLoopDelay, eventLoopUtilization } from "perf_hooks";

// 1. Measure Event Loop Delay (Timer slippage)
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// 2. Measure Event Loop Utilization (Active vs Idle ratio)
let lastELU = eventLoopUtilization();

export const country_codes = iso_codes;

type IngestArgs = {
  source: PipelineSource<any>;
  startDate?: Date;
  endDate?: Date;
};

const cpus_count = cpus().length;
const isDebug = process.argv.includes("--debug");

const resolveWorkerCount = (): number => {
  const configured = Number(process.env.WORKER_THREADS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  // return Math.max(1, Math.min((cpus().length || 1) - 1, 8));
  return Math.max(1, Math.max((cpus_count || 1) - 1, 2));
};

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
    await mkdir("status_logs", { recursive: true });
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
