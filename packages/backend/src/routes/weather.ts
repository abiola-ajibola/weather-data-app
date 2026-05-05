import type { FastifyInstance } from "fastify";

import { prisma } from "@weather-data-app/database";

import { getCachedJson, setCachedJson } from "../lib/cache.js";
import {
  applyFilters,
  applySort,
  classifyCondition,
  dashboardRanges,
  getRangeStart,
  paginate,
  parseFilters,
  toObservationRow,
  type DashboardRange,
  type WeatherObservationRow,
} from "../modules/weather.js";

const dashboardQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    range: {
      type: "string",
      enum: ["24h", "7d", "30d"],
      default: "24h",
    },
    page: { type: "integer", minimum: 1, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 50, default: 50 },
    sortBy: { type: "string", default: "date" },
    sortDirection: { type: "string", enum: ["asc", "desc"], default: "desc" },
    filters: { type: "string" },
  },
} as const;

const weatherCreateBodySchema = {
  type: "object",
  required: ["stationId", "stationName", "date"],
  additionalProperties: false,
  properties: {
    stationId: { type: "string", minLength: 3, maxLength: 30 },
    stationName: { type: "string", minLength: 2, maxLength: 180 },
    date: { type: "string", format: "date" },
    latitude: { type: ["number", "null"] },
    longitude: { type: ["number", "null"] },
    elevationM: { type: ["number", "null"] },
    prcp: { type: ["number", "null"] },
    prcpAttributes: { type: ["string", "null"] },
    tmax: { type: ["number", "null"] },
    tmaxAttributes: { type: ["string", "null"] },
    tmin: { type: ["number", "null"] },
    tminAttributes: { type: ["string", "null"] },
    dapr: { type: ["integer", "null"] },
    daprAttributes: { type: ["string", "null"] },
    datn: { type: ["number", "null"] },
    datnAttributes: { type: ["string", "null"] },
    datx: { type: ["number", "null"] },
    datxAttributes: { type: ["string", "null"] },
    dwpr: { type: ["integer", "null"] },
    dwprAttributes: { type: ["string", "null"] },
    mdpr: { type: ["number", "null"] },
    mdprAttributes: { type: ["string", "null"] },
    mdtn: { type: ["number", "null"] },
    mdtnAttributes: { type: ["string", "null"] },
    mdtx: { type: ["number", "null"] },
    mdtxAttributes: { type: ["string", "null"] },
    tavg: { type: ["number", "null"] },
    tavgAttributes: { type: ["string", "null"] },
  },
} as const;

const bulkDeleteBodySchema = {
  type: "object",
  required: ["ids"],
  additionalProperties: false,
  properties: {
    ids: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "string",
        minLength: 5,
      },
    },
  },
} as const;

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeAttribute = (attrib: unknown): string[] => {
  if (!Array.isArray(attrib)) {
    return [];
  }
  return attrib.map((att) => String(att));
};

const sanitizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeInteger = (value: unknown): number | null => {
  const parsed = sanitizeNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const getDashboardRows = async (
  range: DashboardRange,
): Promise<WeatherObservationRow[]> => {
  const startDate = getRangeStart(range);

  const observations = await prisma.weatherObservation.findMany({
    where: {
      deletedAt: null,
      date: {
        gte: startDate,
      },
    },
    orderBy: {
      date: "desc",
    },
    take: 15_000,
  });

  return observations.map(toObservationRow);
};

export const registerWeatherRoutes = async (
  fastify: FastifyInstance,
): Promise<void> => {
  fastify.get("/api/observations/:id", async (request) => {
    const { id } = request.params as { id: string };

    const observation = await prisma.weatherObservation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!observation) {
      throw fastify.httpErrors.notFound("Observation not found");
    }

    return {
      item: toObservationRow(observation),
    };
  });

  fastify.get(
    "/api/dashboard",
    {
      schema: {
        querystring: dashboardQuerySchema,
      },
    },
    async (request) => {
      const query = request.query as {
        range?: DashboardRange;
        page?: number;
        pageSize?: number;
        sortBy?: keyof WeatherObservationRow;
        sortDirection?: "asc" | "desc";
        filters?: string;
      };

      const range = dashboardRanges.includes(query.range ?? "24h")
        ? (query.range ?? "24h")
        : "24h";
      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 50);
      const sortBy = query.sortBy ?? "date";
      const sortDirection = query.sortDirection === "asc" ? "asc" : "desc";
      const filters = parseFilters(query.filters);

      const cacheKey = `dashboard:${range}:${sortBy}:${sortDirection}:${page}:${pageSize}:${query.filters ?? ""}`;
      const cached = await getCachedJson<unknown>(cacheKey);
      if (cached) {
        return cached;
      }

      const rows = await getDashboardRows(range);

      const stationMaxTmax = new Map<
        string,
        { stationId: string; stationName: string; maxTmax: number }
      >();

      for (const row of rows) {
        if (row.tmax === null) {
          continue;
        }

        const existing = stationMaxTmax.get(row.stationId);

        if (!existing || row.tmax > existing.maxTmax) {
          stationMaxTmax.set(row.stationId, {
            stationId: row.stationId,
            stationName: row.stationName,
            maxTmax: row.tmax,
          });
        }
      }

      const topStations = [...stationMaxTmax.values()]
        .sort((left, right) => right.maxTmax - left.maxTmax)
        .slice(0, 10);

      const topStationIds = new Set(
        topStations.map((station) => station.stationId),
      );
      const baseRows =
        topStationIds.size > 0
          ? rows.filter((row) => topStationIds.has(row.stationId))
          : rows;

      const conditionCounter = new Map<string, number>();

      for (const row of baseRows) {
        const key = classifyCondition(row);
        conditionCounter.set(key, (conditionCounter.get(key) ?? 0) + 1);
      }

      const totalConditions = baseRows.length || 1;
      const conditionBreakdown = [...conditionCounter.entries()].map(
        ([condition, count]) => ({
          condition,
          count,
          percentage: Number(((count / totalConditions) * 100).toFixed(2)),
        }),
      );

      const filteredRows = applyFilters(baseRows, filters);
      const sortedRows = applySort(filteredRows, sortBy, sortDirection);
      const pagedRows = paginate(sortedRows, page, pageSize);

      const result = {
        range,
        topStations,
        conditionBreakdown,
        rows: pagedRows.rows,
        page: pagedRows.page,
        pageSize: pagedRows.pageSize,
        totalRows: pagedRows.total,
      };

      await setCachedJson(cacheKey, result, 60);

      return result;
    },
  );

  fastify.get(
    "/api/stations",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { q } = request.query as { q?: string };
      const query = q?.trim();

      const stations = await prisma.weatherStation.findMany({
        where: {
          OR: [{ deletedAt: { isSet: false } }, { deletedAt: null }],
          ...(query
            ? {
                OR: [
                  {
                    stationId: {
                      contains: query,
                    },
                  },
                  {
                    name: {
                      contains: query,
                    },
                  },
                ],
              }
            : {}),
        },
        take: 20,
        orderBy: {
          stationId: "asc",
        },
      });

      return {
        items: stations.map((station) => ({
          stationId: station.stationId,
          name: station.name,
        })),
      };
    },
  );

  fastify.get(
    "/api/stations/:stationId/observations",
    {
      schema: {
        querystring: dashboardQuerySchema,
      },
    },
    async (request) => {
      const { stationId } = request.params as { stationId: string };
      const query = request.query as {
        page?: number;
        pageSize?: number;
        sortBy?: keyof WeatherObservationRow;
        sortDirection?: "asc" | "desc";
        filters?: string;
      };

      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 50);
      const sortBy = query.sortBy ?? "date";
      const sortDirection = query.sortDirection === "asc" ? "asc" : "desc";
      const filters = parseFilters(query.filters);

      const rows = (
        await prisma.weatherObservation.findMany({
          where: {
            stationId,
            deletedAt: null,
            date: {
              gte: new Date("2020-01-01T00:00:00.000Z"),
            },
          },
          orderBy: {
            date: "desc",
          },
          take: 20_000,
        })
      ).map(toObservationRow);

      const filtered = applyFilters(rows, filters);
      const sorted = applySort(filtered, sortBy, sortDirection);
      const paged = paginate(sorted, page, pageSize);

      return {
        stationId,
        rows: paged.rows,
        totalRows: paged.total,
        page: paged.page,
        pageSize: paged.pageSize,
      };
    },
  );

  fastify.post(
    "/api/observations",
    {
      schema: {
        body: weatherCreateBodySchema,
      },
    },
    async (request) => {
      const body = request.body as Record<string, unknown>;

      const stationId = sanitizeString(body.stationId);
      const stationName = sanitizeString(body.stationName);
      const dateString = sanitizeString(body.date);

      if (!stationId || !stationName || !dateString) {
        throw fastify.httpErrors.badRequest(
          "stationId, stationName and date are required",
        );
      }

      const date = new Date(`${dateString}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime())) {
        throw fastify.httpErrors.badRequest("Invalid date");
      }

      const latitude = sanitizeNumber(body.latitude);
      const longitude = sanitizeNumber(body.longitude);
      const elevationM = sanitizeNumber(body.elevationM);

      await prisma.weatherStation.upsert({
        where: {
          stationId,
        },
        create: {
          stationId,
          name: stationName,
          regionCode: stationName.split(",").at(-1)?.trim() ?? "Unknown",
          latitude,
          longitude,
          elevationM,
        },
        update: {
          name: stationName,
          latitude,
          longitude,
          elevationM,
        },
      });

      const observation = await prisma.weatherObservation.upsert({
        where: {
          stationId_date: {
            stationId,
            date,
          },
        },
        create: {
          stationId,
          stationName,
          date,
          latitude,
          longitude,
          elevationM,
          prcp: sanitizeNumber(body.prcp),
          prcpAttributes: sanitizeAttribute(body.prcpAttributes),
          tmax: sanitizeNumber(body.tmax),
          tmaxAttributes: sanitizeAttribute(body.tmaxAttributes),
          tmin: sanitizeNumber(body.tmin),
          tminAttributes: sanitizeAttribute(body.tminAttributes),
          dapr: sanitizeInteger(body.dapr),
          daprAttributes: sanitizeAttribute(body.daprAttributes),
          datn: sanitizeNumber(body.datn),
          datnAttributes: sanitizeAttribute(body.datnAttributes),
          datx: sanitizeNumber(body.datx),
          datxAttributes: sanitizeAttribute(body.datxAttributes),
          dwpr: sanitizeInteger(body.dwpr),
          dwprAttributes: sanitizeAttribute(body.dwprAttributes),
          mdpr: sanitizeNumber(body.mdpr),
          mdprAttributes: sanitizeAttribute(body.mdprAttributes),
          mdtn: sanitizeNumber(body.mdtn),
          mdtnAttributes: sanitizeAttribute(body.mdtnAttributes),
          mdtx: sanitizeNumber(body.mdtx),
          mdtxAttributes: sanitizeAttribute(body.mdtxAttributes),
          tavg: sanitizeNumber(body.tavg),
          tavgAttributes: sanitizeAttribute(body.tavgAttributes),
        },
        update: {
          stationName,
          latitude,
          longitude,
          elevationM,
          prcp: sanitizeNumber(body.prcp),
          prcpAttributes: sanitizeAttribute(body.prcpAttributes),
          tmax: sanitizeNumber(body.tmax),
          tmaxAttributes: sanitizeAttribute(body.tmaxAttributes),
          tmin: sanitizeNumber(body.tmin),
          tminAttributes: sanitizeAttribute(body.tminAttributes),
          dapr: sanitizeInteger(body.dapr),
          daprAttributes: sanitizeAttribute(body.daprAttributes),
          datn: sanitizeNumber(body.datn),
          datnAttributes: sanitizeAttribute(body.datnAttributes),
          datx: sanitizeNumber(body.datx),
          datxAttributes: sanitizeAttribute(body.datxAttributes),
          dwpr: sanitizeInteger(body.dwpr),
          dwprAttributes: sanitizeAttribute(body.dwprAttributes),
          mdpr: sanitizeNumber(body.mdpr),
          mdprAttributes: sanitizeAttribute(body.mdprAttributes),
          mdtn: sanitizeNumber(body.mdtn),
          mdtnAttributes: sanitizeAttribute(body.mdtnAttributes),
          mdtx: sanitizeNumber(body.mdtx),
          mdtxAttributes: sanitizeAttribute(body.mdtxAttributes),
          tavg: sanitizeNumber(body.tavg),
          tavgAttributes: sanitizeAttribute(body.tavgAttributes),
          deletedAt: null,
        },
      });

      return {
        ok: true,
        item: toObservationRow(observation),
      };
    },
  );

  fastify.put(
    "/api/observations/:id",
    {
      schema: {
        body: {
          ...weatherCreateBodySchema,
          required: ["date"],
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const dateString = sanitizeString(body.date);

      if (!dateString) {
        throw fastify.httpErrors.badRequest("date is required");
      }

      const date = new Date(`${dateString}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime())) {
        throw fastify.httpErrors.badRequest("Invalid date");
      }

      const observation = await prisma.weatherObservation.update({
        where: { id },
        data: {
          date,
          latitude: sanitizeNumber(body.latitude),
          longitude: sanitizeNumber(body.longitude),
          elevationM: sanitizeNumber(body.elevationM),
          prcp: sanitizeNumber(body.prcp),
          prcpAttributes: sanitizeAttribute(body.prcpAttributes),
          tmax: sanitizeNumber(body.tmax),
          tmaxAttributes: sanitizeAttribute(body.tmaxAttributes),
          tmin: sanitizeNumber(body.tmin),
          tminAttributes: sanitizeAttribute(body.tminAttributes),
          dapr: sanitizeInteger(body.dapr),
          daprAttributes: sanitizeAttribute(body.daprAttributes),
          datn: sanitizeNumber(body.datn),
          datnAttributes: sanitizeAttribute(body.datnAttributes),
          datx: sanitizeNumber(body.datx),
          datxAttributes: sanitizeAttribute(body.datxAttributes),
          dwpr: sanitizeInteger(body.dwpr),
          dwprAttributes: sanitizeAttribute(body.dwprAttributes),
          mdpr: sanitizeNumber(body.mdpr),
          mdprAttributes: sanitizeAttribute(body.mdprAttributes),
          mdtn: sanitizeNumber(body.mdtn),
          mdtnAttributes: sanitizeAttribute(body.mdtnAttributes),
          mdtx: sanitizeNumber(body.mdtx),
          mdtxAttributes: sanitizeAttribute(body.mdtxAttributes),
          tavg: sanitizeNumber(body.tavg),
          tavgAttributes: sanitizeAttribute(body.tavgAttributes),
        },
      });

      return {
        ok: true,
        item: toObservationRow(observation),
      };
    },
  );

  fastify.delete(
    "/api/observations",
    {
      schema: {
        body: bulkDeleteBodySchema,
      },
    },
    async (request) => {
      const body = request.body as { ids: string[] };

      const result = await prisma.weatherObservation.updateMany({
        where: {
          id: {
            in: body.ids,
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        ok: true,
        count: result.count,
      };
    },
  );
};
