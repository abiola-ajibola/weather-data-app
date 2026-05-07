import type { FastifyInstance } from "fastify";

import { prisma, Prisma } from "@weather-data-app/database";

import { getCachedJson, setCachedJson } from "../lib/cache.js";
import {
  classifyCondition,
  dashboardRanges,
  FilterOperator,
  getRangeStart,
  numericFields,
  parseFilters,
  stringFields,
  toNumeric,
  toObservationRow,
  WeatherFilter,
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

const mapDateOperator = (operator: FilterOperator) => {
  switch (operator) {
    case "after":
      return "gt";
    case "before":
      return "lt";
    case "on":
      return "equals";
    default:
      return null;
  }
};

const mapNumericOperator = (operator: FilterOperator) => {
  switch (operator) {
    case "max-value":
      return "lte";
    case "min-value":
      return "gte";
    case "exact":
      return "eaquals";
    default:
      return null;
  }
};

const mapStringOperator = (operator: FilterOperator) => {
  switch (operator) {
    case "contains":
      return "contains";
    case "not":
      return "not";
    case "is":
      return "equals";
    default:
      return null;
  }
};

const getWeatherObservation = async ({
  where,
  range,
  filters,
  sortBy,
  sortDirection,
  page,
  pageSize,
}: {
  where?: Prisma.WeatherObservationWhereInput;
  range?: DashboardRange;
  filters?: WeatherFilter[];
  sortBy: keyof WeatherObservationRow;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
}): Promise<{
  rows: WeatherObservationRow[];
  total: number;
  page: number;
  pageSize: number;
}> => {
  const startDate = range && getRangeStart(range);
  const andFilter: Prisma.WeatherObservationWhereInput["AND"] = [];

  if (filters && Array.isArray(filters)) {
    for (let { column, operator, value } of filters) {
      if (column === "date" && !startDate) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const mappedOperator = mapDateOperator(operator);
          if (mappedOperator) {
            const f: (typeof andFilter)[0] = {
              date: { [mappedOperator]: date },
            };
            andFilter.push(f);
          }
        }
      }
      if (numericFields.has(column)) {
        const filterValue = toNumeric(value);
        if (filterValue !== null) {
          const mappedOperator = mapNumericOperator(operator);
          if (mappedOperator) {
            const f: (typeof andFilter)[0] = {
              [column]: { [mappedOperator]: filterValue },
            };
            andFilter.push(f);
          }
        }
      }
      if (stringFields.has(column)) {
        const filterValue = String(value);
        const mappedOperator = mapStringOperator(operator);
        if (mappedOperator) {
          const f: (typeof andFilter)[0] = {
            [column]:
              mappedOperator === "not"
                ? { not: { contains: filterValue } }
                : { [mappedOperator]: filterValue },
          };
          andFilter.push(f);
        }
      }
    }
  }

  const whereClause: Prisma.WeatherObservationWhereInput = {
    OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    ...(startDate
      ? {
          date: {
            gte: startDate,
          },
        }
      : {}),
    AND: andFilter,
    ...where,
  };

  const orderBy = sortBy
    ? {
        [sortBy]: sortDirection === "asc" ? "asc" : "desc",
      }
    : { date: "asc" as Prisma.SortOrder };

  const [observations, count] = await Promise.all([
    prisma.weatherObservation.findMany({
      where: whereClause,
      orderBy,
      take: pageSize,
      skip: (page < 1 ? 0 : page - 1) * pageSize,
    }),
    prisma.weatherObservation.count({
      where: whereClause,
      orderBy,
    }),
  ]);

  return {
    rows: observations.map(toObservationRow),
    total: count,
    page,
    pageSize,
  };
};

export const registerWeatherRoutes = async (
  fastify: FastifyInstance,
): Promise<void> => {
  fastify.get("/api/observations/:id", async (request) => {
    const { id: stationId } = request.params as { id: string };

    const observation = await prisma.weatherObservation.findFirst({
      where: {
        stationId,
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
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

      const { rows, total } = await getWeatherObservation({
        range,
        filters,
        sortBy,
        sortDirection,
        page,
        pageSize,
      });

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

      const baseRows =
        stationMaxTmax.size > 0
          ? rows.filter((row) => stationMaxTmax.has(row.stationId))
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

      const result = {
        range,
        topStations,
        conditionBreakdown,
        rows,
        page,
        pageSize,
        totalRows: total,
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

      const cacheKey = `observations:${stationId}:${sortBy}:${sortDirection}:${page}:${pageSize}:${query.filters ?? ""}`;
      const cached = await getCachedJson<unknown>(cacheKey);
      if (cached) {
        return cached;
      }

      const {
        rows,
        total,
        page: currentPage,
        pageSize: currentPageSize,
      } = await getWeatherObservation({
        where: { stationId },
        filters,
        sortBy,
        sortDirection,
        page,
        pageSize,
      });

      return {
        stationId,
        rows,
        totalRows: total,
        page: currentPage,
        pageSize: currentPageSize,
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
