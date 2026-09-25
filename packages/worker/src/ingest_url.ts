import { get } from "node:https";
import { IncomingMessage } from "node:http";

import { prisma } from "@weather-data-app/database";
import { ingestStationFile } from "./index.js";
import { TempFileDuplexStream } from "./lib/tempFileDuplexStream.js";

async function ingestUrl() {
  try {
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

    response.on("error", (err) => {
      console.log({ responseError: err });
    });

    response.on("aborted", (err) => {
      console.log({ responseErrorAb: err });
    });
    const tempFileSream = new TempFileDuplexStream(
      Number(response.headers["content-length"]),
    );
    response.pipe(tempFileSream);

    await ingestStationFile({
      source: tempFileSream,
      startDate: new Date("2026-05-03"),
      endDate: new Date(""),
    });
  } catch (error) {
    console.error("Injest URL Error");
    console.error(error);
  }
}

ingestUrl()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => await prisma.$disconnect());
