import { createReadStream } from "node:fs";
import minimist from "minimist";
import { ingestStationFile } from "./index.js";
import { prisma } from "@weather-data-app/database";

type CliArgs = {
  file?: string;
  startDate?: string;
  endDate?: string;
  _: string[];
};

const parseDate = (
  value: string | undefined,
  label: string,
): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(
      `Invalid ${label}: "${value}". Use an ISO date, e.g. 2024-01-01.`,
    );
  }

  return parsedDate;
};

async function ingestFile() {
  const args = minimist(process.argv.slice(2), {
    string: ["file", "startDate", "endDate"],
    alias: { f: "file", s: "startDate", e: "endDate" },
  }) as CliArgs;

  const filePath = args.file;

  console.log(`file path: ${filePath}`);

  if (!filePath) {
    throw new Error(
      'Missing file path. Usage: yarn workspace @weather-data-app/worker ingest:file -- --file "path/to/file.tar.gz" [--startDate 2024-01-01] [--endDate 2024-12-31]',
    );
  }

  const startDate = parseDate(args.startDate, "startDate");
  const endDate = parseDate(args.endDate, "endDate");

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new Error("startDate must be before or equal to endDate.");
  }

  const source = createReadStream(filePath);
  await ingestStationFile({ source, startDate, endDate });
}

ingestFile()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => await prisma.$disconnect());
