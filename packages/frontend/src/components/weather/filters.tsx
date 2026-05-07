import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  FilterOperator,
  WeatherFilter,
  WeatherObservationRow,
} from "@/lib/types";

export type ColumnMeta = {
  key: keyof WeatherObservationRow;
  label: string;
  type: "number" | "string" | "date";
};

type WeatherFiltersProps = {
  filters: WeatherFilter[];
  onChange: (filters: WeatherFilter[]) => void;
  columns: ColumnMeta[];
};

const operatorsByType: Record<
  ColumnMeta["type"],
  Array<{ value: FilterOperator; label: string }>
> = {
  number: [
    { value: "min-value", label: "Min value" },
    { value: "max-value", label: "Max value" },
    { value: "exact", label: "Exact" },
  ],
  string: [
    { value: "contains", label: "Contains" },
    { value: "not", label: "Not contains" },
    { value: "is", label: "Is exactly" },
  ],
  date: [
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "on", label: "On date" },
  ],
};

const buildDefaultFilter = (column: ColumnMeta): WeatherFilter => ({
  column: column.key,
  operator: operatorsByType[column.type][0].value,
  value: "",
});

const getColumnMeta = (
  columns: ColumnMeta[],
  key: keyof WeatherObservationRow,
): ColumnMeta => columns.find((column) => column.key === key) ?? columns[0];

export const WeatherFilters = ({
  filters,
  onChange,
  columns,
}: WeatherFiltersProps) => {

  const addFilter = () => {
    const firstColumn = columns[0];
    if (!firstColumn) {
      return;
    }

    onChange([...filters, buildDefaultFilter(firstColumn)])
  }

  return (
    <div className="space-y-3">
      {filters.map((filter, index) => {
        const selectedColumn = getColumnMeta(columns, filter.column);
        const operators = operatorsByType[selectedColumn.type];

        return (
          <div
            key={`${filter.column}-${index}`}
            className="grid grid-cols-1 gap-2 rounded-xl border border-border/80 bg-card/60 p-3 md:grid-cols-[1fr_180px_1fr_auto]"
          >
            <Select
              value={filter.column}
              onChange={(event) => {
                const column = getColumnMeta(
                  columns,
                  event.target.value as keyof WeatherObservationRow,
                );
                const next = [...filters];
                next[index] = buildDefaultFilter(column);
                onChange(next);
              }}
            >
              {columns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </Select>

            <Select
              value={filter.operator}
              onChange={(event) => {
                const next = [...filters];
                next[index] = {
                  ...next[index],
                  operator: event.target.value as FilterOperator,
                };
                onChange(next);
              }}
            >
              {operators.map((operator) => (
                <option key={operator.value} value={operator.value}>
                  {operator.label}
                </option>
              ))}
            </Select>

            <Input
              value={String(filter.value)}
              type={
                selectedColumn.type === "number"
                  ? "number"
                  : selectedColumn.type === "date"
                    ? "date"
                    : "text"
              }
              onChange={(event) => {
                const next = [...filters];
                next[index] = {
                  ...next[index],
                  value:
                    selectedColumn.type === "number"
                      ? event.target.value.length === 0
                        ? ""
                        : Number(event.target.value)
                      : event.target.value,
                };
                onChange(next);
              }}
            />

            <Button
              variant="ghost"
              className="h-10 w-10 p-0"
              onClick={() => {
                onChange(
                  filters.filter((_, filterIndex) => filterIndex !== index),
                );
              }}
              aria-label="Remove filter"
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}

      <Button variant="secondary" className="gap-2" onClick={addFilter}>
        <Plus className="size-4" />
        Add filter
      </Button>
    </div>
  );
};
