import { get, IncomingMessage } from "node:http";

import { prisma } from "@weather-data-app/database";
import { ingestStationFile } from "./index.js";

async function ingestUrl() {
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    get(
      new URL(
        "https://www.ncei.noaa.gov/data/daily-summaries/archive/daily-summaries-latest.tar.gz",
      ),
      {
        method: "GET",
      },
      (res) => {
        res.on("error", reject);
        resolve(res);
      },
    );
  });
  ingestStationFile({
    source: response,
    startDate: new Date("2026-05-03"),
    endDate: new Date(""),
  });
}

ingestUrl()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => await prisma.$disconnect());
