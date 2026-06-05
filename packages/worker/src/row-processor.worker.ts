import { parentPort, workerData } from "node:worker_threads";

import { prisma } from "@weather-data-app/database";

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

type RowProcessRequest = {
  id: number;
  row: CsvRow;
};

type RowProcessResponse = {
  id: number;
  result?: {
    status: "saved" | "skipped";
  };
  error?: string;
};

type WorkerConfig = {
  startTime: number | null;
  endTime: number | null;
};

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

const shouldSkipByDate = (
  row: CsvRow,
  startTime: number | null,
  endTime: number | null,
): boolean => {
  const time = row.DATE ? new Date(row.DATE).getTime() : 0;
  const min = startTime ?? 0;
  const max = endTime ?? Number.POSITIVE_INFINITY;
  return time < min || time > max;
};

const processRow = async (
  row: CsvRow,
  startTime: number | null,
  endTime: number | null,
): Promise<{ status: "saved" | "skipped" }> => {
  if (shouldSkipByDate(row, startTime, endTime)) {
    return { status: "skipped" };
  }

  const stationId = row.STATION?.trim() || "";
  const stationName = row.NAME?.trim() || "";

  if (!stationId || !stationName) {
    return { status: "skipped" };
  }

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

  await prisma.weatherStation.upsert({
    where: { stationId },
    create: station,
    update: {
      name: station.name,
      regionCode: station.regionCode,
      latitude: station.latitude,
      longitude: station.longitude,
      elevationM: station.elevationM,
    },
  });

  await prisma.weatherObservation.upsert({
    where: {
      stationId_date: { stationId: data.stationId, date: data.date },
    },
    create: data,
    update: data,
  });

  return { status: "saved" };
};

if (!parentPort) {
  throw new Error("Row processor worker requires a parent port.");
}

const port = parentPort;

const { startTime, endTime } = workerData as WorkerConfig;

port.on("message", (message: RowProcessRequest) => {
  void processRow(message.row, startTime, endTime)
    .then((result) => {
      port.postMessage({ id: message.id, result } satisfies RowProcessResponse);
    })
    .catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      port.postMessage({
        id: message.id,
        error: errorMessage,
      } satisfies RowProcessResponse);
    });
});
