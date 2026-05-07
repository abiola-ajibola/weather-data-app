import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { extract } from "tar-stream";

import { prisma } from "@weather-data-app/database";
import { parse } from "csv-parse";
import { get } from "node:https";

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

type StationPayload = {
  stationId: string;
  name: string;
  regionCode: string;
  latitude: number;
  longitude: number;
  elevationM: number;
};

type ObservationPayload = {
  stationId: string;
  stationName: string;
  date: Date;
  latitude: number;
  longitude: number;
  elevationM: number;
  prcp: number | null;
  prcpAttributes: string[];
  tavg: number | null;
  tavgAttributes: string[];
  tmax: number | null;
  tmaxAttributes: string[];
  tmin: number | null;
  tminAttributes: string[];
  dapr: number | null;
  daprAttributes: string[];
  datn: number | null;
  datnAttributes: string[];
  datx: number | null;
  datxAttributes: string[];
  dwpr: number | null;
  dwprAttributes: string[];
  mdpr: number | null;
  mdprAttributes: string[];
  mdtn: number | null;
  mdtnAttributes: string[];
  mdtx: number | null;
  mdtxAttributes: string[];
};

type IngestArgs = { sourceUrl: string; startDate?: Date; endDate?: Date };

const toNumber = (value: string | undefined): number => {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toScaledNumber = (value: string | undefined): number | null => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed) / 10;
};

const toInteger = (value: string | undefined): number | null => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
};

const toAttribute = (value: string | undefined): string[] => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue.split(",") : [];
};

const toDate = (value: string | undefined): Date => {
  if (!value) {
    throw new Error("Missing DATE column value in CSV row");
  }

  return new Date(`${value}T00:00:00.000Z`);
};

const extractRegionCode = (stationName: string): string => {
  const parts = stationName.split(",").map((part) => part.trim());
  return parts.length > 1 ? parts[parts.length - 1] : "Unknown";
};

// const controller = new AbortController();

const ingestStationFile = async ({
  sourceUrl,
  startDate,
  endDate,
}: IngestArgs): Promise<void> => {
  const gunzip = createGunzip();
  const extractor = extract();
  const startTime = startDate?.getTime();
  const endTime = endDate?.getTime();

  extractor.on("entry", async (headers, stream, next) => {
    console.log("entry");
    console.log(headers.name);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      autoParse: true,
    });

    parser.on("data", async (row: CsvRow) => {
      const time = row.DATE ? new Date(row.DATE).getTime() : 0;
      if (time >= (startTime || 0) && time <= (endTime || Infinity)) {
        const stationId = row.STATION?.trim() || "";
        const stationName = row.NAME?.trim() || "";
        const station: StationPayload = {
          stationId,
          name: stationName,
          regionCode: extractRegionCode(stationName),
          latitude: toNumber(row.LATITUDE),
          longitude: toNumber(row.LONGITUDE),
          elevationM: toNumber(row.ELEVATION),
        };
        const data: ObservationPayload = {
          stationId,
          stationName,
          date: toDate(row.DATE),
          latitude: toNumber(row.LATITUDE),
          longitude: toNumber(row.LONGITUDE),
          elevationM: toNumber(row.ELEVATION),
          prcp: toScaledNumber(row.PRCP),
          prcpAttributes: toAttribute(row.PRCP_ATTRIBUTES),
          tavg: toScaledNumber(row.TAVG),
          tavgAttributes: toAttribute(row.TAVG_ATTRIBUTES),
          tmax: toScaledNumber(row.TMAX),
          tmaxAttributes: toAttribute(row.TMAX_ATTRIBUTES),
          tmin: toScaledNumber(row.TMIN),
          tminAttributes: toAttribute(row.TMIN_ATTRIBUTES),
          dapr: toInteger(row.DAPR),
          daprAttributes: toAttribute(row.DAPR_ATTRIBUTES),
          datn: toScaledNumber(row.DATN),
          datnAttributes: toAttribute(row.DATN_ATTRIBUTES),
          datx: toScaledNumber(row.DATX),
          datxAttributes: toAttribute(row.DATX_ATTRIBUTES),
          dwpr: toInteger(row.DWPR),
          dwprAttributes: toAttribute(row.DWPR_ATTRIBUTES),
          mdpr: toScaledNumber(row.MDPR),
          mdprAttributes: toAttribute(row.MDPR_ATTRIBUTES),
          mdtn: toScaledNumber(row.MDTN),
          mdtnAttributes: toAttribute(row.MDTN_ATTRIBUTES),
          mdtx: toScaledNumber(row.MDTX),
          mdtxAttributes: toAttribute(row.MDTX_ATTRIBUTES),
        };

        const existingStation = await prisma.weatherStation.findUnique({
          where: { stationId: station.stationId },
        });

        if (!existingStation)
          await prisma.weatherStation.create({
            data: station,
          });

        await prisma.weatherObservation.upsert({
          where: {
            stationId_date: { stationId: station.stationId, date: data.date },
          },
          create: data,
          update: data,
        });
        // if (data.date.getDate() >= 31) {
        //   controller.abort();
        // }
      }
    });

    parser.on("error", function (err) {
      console.log({ err });
    });
    stream.on("error", (err) => next(err));
    stream.on("data", async (chunk: Buffer) => {
      parser.write(chunk);
    });
    stream.on("end", () => {
      next();
    });
  });

  get(
    new URL(sourceUrl),
    {
      method: "GET",
      // signal: controller.signal,
    },
    async (res) => {
      try {
        await pipeline(res, gunzip, extractor);
      } catch (error) {
        console.log({ error });
      }
    },
  );
};

ingestStationFile({
  sourceUrl:
    "https://www.ncei.noaa.gov/data/daily-summaries/archive/daily-summaries-latest.tar.gz",
  startDate: new Date("2026-05-03"),
  endDate: new Date(""),
})
  .catch(console.trace)
  .finally(async () => await prisma.$disconnect());
