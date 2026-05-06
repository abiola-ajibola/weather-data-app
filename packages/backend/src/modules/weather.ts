import type { WeatherObservation } from "@weather-data-app/database";

export const dashboardRanges = ["24h", "7d", "30d"] as const;

export type DashboardRange = (typeof dashboardRanges)[number];

export type FilterOperator =
  | "min-value"
  | "max-value"
  | "exact"
  | "contains"
  | "not"
  | "is"
  | "before"
  | "after"
  | "on";

export type WeatherFilter = {
  column: keyof WeatherObservationRow;
  operator: FilterOperator;
  value: string | number;
};

export type WeatherObservationRow = {
  id: string;
  stationId: string;
  stationName: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  elevationM: number | null;
  prcp: number | null;
  prcpAttributes: string[];
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
  tavg: number | null;
  tavgAttributes: string[];
};

export const numericFields = new Set<keyof WeatherObservationRow>([
  "latitude",
  "longitude",
  "elevationM",
  "prcp",
  "tmax",
  "tmin",
  "dapr",
  "datn",
  "datx",
  "dwpr",
  "mdpr",
  "mdtn",
  "mdtx",
  "tavg",
]);

export const stringFields = new Set<keyof WeatherObservationRow>([
  "stationId",
  "stationName",
  "prcpAttributes",
  "tmaxAttributes",
  "tminAttributes",
  "daprAttributes",
  "datnAttributes",
  "datxAttributes",
  "dwprAttributes",
  "mdprAttributes",
  "mdtnAttributes",
  "mdtxAttributes",
  "tavgAttributes",
]);

export const toNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toObservationRow = (
  observation: WeatherObservation,
): WeatherObservationRow => ({
  id: observation.id,
  stationId: observation.stationId,
  stationName: observation.stationName,
  date: observation.date.toISOString(),
  latitude: observation.latitude ?? null,
  longitude: observation.longitude ?? null,
  elevationM: observation.elevationM ?? null,
  prcp: observation.prcp ?? null,
  prcpAttributes: observation.prcpAttributes ?? null,
  tmax: observation.tmax ?? null,
  tmaxAttributes: observation.tmaxAttributes ?? null,
  tmin: observation.tmin ?? null,
  tminAttributes: observation.tminAttributes ?? null,
  dapr: observation.dapr ?? null,
  daprAttributes: observation.daprAttributes ?? null,
  datn: observation.datn ?? null,
  datnAttributes: observation.datnAttributes ?? null,
  datx: observation.datx ?? null,
  datxAttributes: observation.datxAttributes ?? null,
  dwpr: observation.dwpr ?? null,
  dwprAttributes: observation.dwprAttributes ?? null,
  mdpr: observation.mdpr ?? null,
  mdprAttributes: observation.mdprAttributes ?? null,
  mdtn: observation.mdtn ?? null,
  mdtnAttributes: observation.mdtnAttributes ?? null,
  mdtx: observation.mdtx ?? null,
  mdtxAttributes: observation.mdtxAttributes ?? null,
  tavg: observation.tavg ?? null,
  tavgAttributes: observation.tavgAttributes ?? null,
});

export const getRangeStart = (range: DashboardRange): Date => {
  const now = new Date();

  if (range === "24h") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
};

export const parseFilters = (input: string | undefined): WeatherFilter[] => {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is WeatherFilter => {
        if (typeof value !== "object" || value === null) {
          return false;
        }

        const filter = value as Partial<WeatherFilter>;

        return (
          typeof filter.column === "string" &&
          typeof filter.operator === "string" &&
          (typeof filter.value === "string" || typeof filter.value === "number")
        );
      })
      .filter(
        (filter) =>
          !(
            typeof filter.value === "string" && filter.value.trim().length === 0
          ),
      )
      .map((filter) => ({
        column: filter.column,
        operator: filter.operator,
        value: filter.value,
      }));
  } catch {
    return [];
  }
};

const matchesFilter = (
  row: WeatherObservationRow,
  filter: WeatherFilter,
): boolean => {
  const value = row[filter.column];

  if (filter.column === "date") {
    const rowDate = new Date(row.date).getTime();
    const filterDate = new Date(String(filter.value)).getTime();

    if (!Number.isFinite(rowDate) || !Number.isFinite(filterDate)) {
      return false;
    }

    if (filter.operator === "before") {
      return rowDate < filterDate;
    }

    if (filter.operator === "after") {
      return rowDate > filterDate;
    }

    if (filter.operator === "on") {
      const rowIso = new Date(rowDate).toISOString().slice(0, 10);
      const filterIso = new Date(filterDate).toISOString().slice(0, 10);
      return rowIso === filterIso;
    }

    return true;
  }

  if (numericFields.has(filter.column)) {
    const rowNumber = toNumeric(value);
    const filterNumber = toNumeric(filter.value);

    if (rowNumber === null || filterNumber === null) {
      return false;
    }

    if (filter.operator === "min-value") {
      return rowNumber >= filterNumber;
    }

    if (filter.operator === "max-value") {
      return rowNumber <= filterNumber;
    }

    if (filter.operator === "exact") {
      return rowNumber === filterNumber;
    }

    return true;
  }

  if (stringFields.has(filter.column)) {
    const rowString = String(value ?? "").toLowerCase();
    const filterString = String(filter.value).toLowerCase();

    if (filter.operator === "contains") {
      return rowString.includes(filterString);
    }

    if (filter.operator === "not") {
      return !rowString.includes(filterString);
    }

    if (filter.operator === "is") {
      return rowString === filterString;
    }

    return true;
  }

  return true;
};

export const applyFilters = (
  rows: WeatherObservationRow[],
  filters: WeatherFilter[],
): WeatherObservationRow[] => {
  if (filters.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    filters.every((filter) => matchesFilter(row, filter)),
  );
};

export const applySort = (
  rows: WeatherObservationRow[],
  sortBy: keyof WeatherObservationRow,
  sortDirection: "asc" | "desc",
): WeatherObservationRow[] => {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];

    if (sortBy === "date") {
      return (
        (new Date(String(leftValue)).getTime() -
          new Date(String(rightValue)).getTime()) *
        direction
      );
    }

    const leftNumber = toNumeric(leftValue);
    const rightNumber = toNumeric(rightValue);

    if (leftNumber !== null && rightNumber !== null) {
      return (leftNumber - rightNumber) * direction;
    }

    return (
      String(leftValue ?? "").localeCompare(String(rightValue ?? "")) *
      direction
    );
  });
};

export const paginate = <T>(
  rows: T[],
  page: number,
  pageSize: number,
): { rows: T[]; total: number; page: number; pageSize: number } => {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(50, pageSize));
  const start = (safePage - 1) * safeSize;

  return {
    rows: rows.slice(start, start + safeSize),
    total: rows.length,
    page: safePage,
    pageSize: safeSize,
  };
};

export const classifyCondition = (row: WeatherObservationRow): string => {
  if ((row.prcp ?? 0) > 0) {
    return "Rainy";
  }

  if ((row.tmax ?? Number.NEGATIVE_INFINITY) >= 30) {
    return "Hot";
  }

  if ((row.tmin ?? Number.POSITIVE_INFINITY) <= 5) {
    return "Cold";
  }

  return "Mild";
};
