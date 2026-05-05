import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { WeatherFilters } from "@/components/weather/filters";
import { WeatherTable } from "@/components/weather/weather-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteObservations, fetchStationObservations } from "@/lib/api";
import type {
  SortDirection,
  WeatherFilter,
  WeatherObservationRow,
} from "@/lib/types";
import { defaultFilterColumns } from "@/lib/constants";

export const StationPage = () => {
  const queryClient = useQueryClient();
  const params = useParams();
  const stationId = params.stationId ?? "";

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<keyof WeatherObservationRow>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filters, setFilters] = useState<WeatherFilter[]>([]);

  const queryKey = useMemo(
    () => [
      "station-observations",
      stationId,
      page,
      pageSize,
      sortBy,
      sortDirection,
      filters,
    ],
    [filters, page, pageSize, sortBy, sortDirection, stationId],
  );

  const stationQuery = useQuery({
    queryKey,
    enabled: stationId.length > 0,
    queryFn: () =>
      fetchStationObservations(stationId, {
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
      await queryClient.invalidateQueries({
        queryKey: ["station-observations", stationId],
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const stationFilterColumns = defaultFilterColumns.filter(
    (column) => column.key !== "stationName",
  );

  return (
    <section className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Station Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Station ID: <strong>{stationId}</strong> | Data from Jan 1, 2020 to
            present.
          </p>
          <Link
            to="/"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Back to dashboard
          </Link>
        </CardHeader>
        <CardContent>
          <WeatherFilters
            filters={filters}
            columns={stationFilterColumns}
            onChange={(nextFilters) => {
              setFilters(nextFilters);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <WeatherTable
        title={`Station ${stationId} rows`}
        rows={stationQuery.data?.rows ?? []}
        totalRows={stationQuery.data?.totalRows ?? 0}
        page={stationQuery.data?.page ?? page}
        pageSize={stationQuery.data?.pageSize ?? pageSize}
        sortBy={sortBy}
        sortDirection={sortDirection}
        filters={filters}
        loading={stationQuery.isFetching || deleteMutation.isPending}
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
