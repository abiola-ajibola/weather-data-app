import { get } from "node:https";
import { IncomingMessage } from "node:http";

import { prisma } from "@weather-data-app/database";
import { ingestStationFile } from "./index.js";
import { TempFileDuplexStream } from "./lib/tempFileDuplexStream.js";
import { abortEmitter } from "./lib/abortEventEmitter.js";

const fetchFile = async (offset = 0) => {
  let recieved = 0;
  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    const request = get(
      new URL(
        "https://www.ncei.noaa.gov/data/daily-summaries/archive/daily-summaries-latest.tar.gz",
      ),
      {
        method: "GET",
        headers: {
          range: `bytes=${offset}-`,
        },
      },
      (res) => {
        res.on("error", reject);
        resolve(res);
      },
    );
    request.on("abort", (error) => {
      console.log({ requestAbort: error });
    });
    request.on("error", (err) => {
      console.log({ requestErr: err });
    });
  });
  res.on("error", (err) => {
    console.log({ responseError: err });
  });

  res.on("aborted", (err) => {
    console.log({ responseErrorAb: err });
    abortEmitter.emit("abort-message", offset + recieved);
  });
  res.on("close", (err) => {
    console.log({ responseErrorClose: err });
    abortEmitter.emit("abort-message", offset + recieved);
  });
  res.on("data", (chunk: Buffer) => {
    recieved += chunk.length;
  });
  return res;
};

async function ingestUrl() {
  try {
    const response = await fetchFile();

    const tempFileSream = new TempFileDuplexStream();
    response.pipe(tempFileSream);

    abortEmitter.on("abort-message", async (offset: number) => {
      console.log({ offset });
      const newResponse = await fetchFile(offset);
      response.unpipe(tempFileSream);
      newResponse.pipe(tempFileSream);
    });

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
