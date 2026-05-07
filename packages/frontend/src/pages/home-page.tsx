import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { DashboardCharts } from "@/components/weather/dashboard-charts";
import { WeatherFilters } from "@/components/weather/filters";
import { WeatherTable } from "@/components/weather/weather-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { deleteObservations, fetchDashboard } from "@/lib/api";
import type {
  DashboardRange,
  SortDirection,
  WeatherFilter,
  WeatherObservationRow,
} from "@/lib/types";
import { defaultFilterColumns } from "@/lib/constants";
import { useSearchParams } from "react-router-dom";
import { getInitialFilters } from "@/lib/searchParamsValiation";

const dashboardRangeSchema = z.enum(["24h", "7d", "30d"]);

const getInitialRange = (value: string | null) => {
  if (!value) return "24h";
  try {
    const result = dashboardRangeSchema.safeParse(value);

    return result.success ? result.data : "24h";
  } catch (error) {
    console.error({ error });
    return "24h";
  }
};

export const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams(
    window.location.search,
  );
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DashboardRange>(
    getInitialRange(searchParams.get("range")),
  );
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<keyof WeatherObservationRow>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filters, setFilters] = useState<WeatherFilter[]>(
    getInitialFilters(searchParams.get("filters") || null),
  );

  const queryKey = useMemo(
    () => ["dashboard", range, page, pageSize, sortBy, sortDirection, filters],
    [filters, page, pageSize, range, sortBy, sortDirection],
  );

  const dashboardQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchDashboard(range, {
        page,
        pageSize,
        sortBy,
        sortDirection,
        filters,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteObservations,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <section className="space-y-5">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Weather Summary Dashboard</CardTitle>
          <div className="inline-flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Range
            </span>
            <Select
              className="w-44"
              value={range}
              onChange={(event) => {
                setRange(event.target.value as DashboardRange);
                setSearchParams((params) => ({
                  ...Object.fromEntries(params.entries()),
                  range: event.target.value,
                }));
                setPage(1);
              }}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 1 week</option>
              <option value="30d">Last 30 days</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <WeatherFilters
            filters={filters}
            columns={defaultFilterColumns}
            onChange={(nextFilters) => {
              setFilters(nextFilters);
              setSearchParams((params) => ({
                ...Object.fromEntries(params.entries()),
                filters: JSON.stringify(nextFilters),
              }));
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <DashboardCharts
        topStations={dashboardQuery.data?.topStations ?? []}
        conditionBreakdown={dashboardQuery.data?.conditionBreakdown ?? []}
      />

      <WeatherTable
        title="Weather Rows"
        rows={dashboardQuery.data?.rows ?? []}
        totalRows={dashboardQuery.data?.totalRows ?? 0}
        page={dashboardQuery.data?.page ?? page}
        pageSize={dashboardQuery.data?.pageSize ?? pageSize}
        sortBy={sortBy}
        sortDirection={sortDirection}
        filters={filters}
        loading={dashboardQuery.isFetching || deleteMutation.isPending}
        onPageChange={setPage}
        onSortChange={(column, direction) => {
          setSortBy(column);
          setSortDirection(direction);
          setPage(1);
        }}
        onDeleteSelected={async (ids) => {
          if (ids.length === 0) {
            return;
          }

          await deleteMutation.mutateAsync(ids);
        }}
      />
    </section>
  );
};
