import type { ColumnMeta } from "@/components/weather/filters";

export const defaultFilterColumns: ColumnMeta[] = [
  { key: 'stationName', label: 'Station Name', type: 'string' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'tmax', label: 'Max Temp', type: 'number' },
  { key: 'tmin', label: 'Min Temp', type: 'number' },
  { key: 'tavg', label: 'Avg Temp', type: 'number' },
  { key: 'prcp', label: 'Precipitation', type: 'number' },
  { key: 'datx', label: 'Daily Max Temp', type: 'number' },
  { key: 'datn', label: 'Daily Min Temp', type: 'number' },
  { key: 'dapr', label: 'Days of Precip', type: 'number' },
  { key: 'dwpr', label: 'Days with Rain', type: 'number' },
]