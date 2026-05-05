import { ArrowDown, ArrowUp, LoaderCircle, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  SortDirection,
  WeatherFilter,
  WeatherObservationRow,
} from '@/lib/types'
import { toTitleCase } from '@/lib/utils'

type WeatherTableProps = {
  title: string
  rows: WeatherObservationRow[]
  page: number
  pageSize: number
  totalRows: number
  sortBy: keyof WeatherObservationRow
  sortDirection: SortDirection
  filters: WeatherFilter[]
  onPageChange: (page: number) => void
  onSortChange: (
    sortBy: keyof WeatherObservationRow,
    direction: SortDirection,
  ) => void
  onDeleteSelected: (ids: string[]) => Promise<void>
  loading?: boolean
}

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString()
  }

  return String(value)
}

const columns: Array<{ key: keyof WeatherObservationRow; label: string }> = [
  { key: 'stationName', label: 'Station' },
  { key: 'date', label: 'Date' },
  { key: 'tmax', label: 'Tmax' },
  { key: 'tmin', label: 'Tmin' },
  { key: 'tavg', label: 'Tavg' },
  { key: 'prcp', label: 'Prcp' },
  { key: 'datx', label: 'Datx' },
  { key: 'datn', label: 'Datn' },
  { key: 'dapr', label: 'Dapr' },
  { key: 'dwpr', label: 'Dwpr' },
]

export const WeatherTable = ({
  title,
  rows,
  page,
  pageSize,
  totalRows,
  sortBy,
  sortDirection,
  filters,
  onPageChange,
  onSortChange,
  onDeleteSelected,
  loading,
}: WeatherTableProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const sortIndicator = (column: keyof WeatherObservationRow) => {
    if (sortBy !== column) {
      return null
    }

    return sortDirection === 'asc' ? (
      <ArrowUp className="size-3" />
    ) : (
      <ArrowDown className="size-3" />
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalRows.toLocaleString()} rows | {filters.length} active filters
          </p>
        </div>
        <Button
          variant="danger"
          className="gap-2"
          disabled={selectedIds.length === 0 || loading}
          onClick={async () => {
            await onDeleteSelected(selectedIds)
            setSelectedIds([])
          }}
        >
          <Trash2 className="size-4" />
          Delete selected
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-240 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left">Select</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-2 py-2 text-left">
                    <button
                      className="inline-flex items-center gap-1 font-semibold"
                      type="button"
                      onClick={() => {
                        const nextDirection: SortDirection =
                          sortBy === column.key && sortDirection === 'desc'
                            ? 'asc'
                            : 'desc'
                        onSortChange(column.key, nextDirection)
                      }}
                    >
                      {column.label}
                      {sortIndicator(column.key)}
                    </button>
                  </th>
                ))}
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/70 align-top">
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Select ${row.id}`}
                      type="checkbox"
                      className="size-4"
                      checked={selectedIdSet.has(row.id)}
                      onChange={(event) => {
                        setSelectedIds((current) => {
                          if (event.target.checked) {
                            return current.includes(row.id)
                              ? current
                              : [...current, row.id]
                          }

                          return current.filter((id) => id !== row.id)
                        })
                      }}
                    />
                  </td>
                  {columns.map((column) => (
                    <td key={`${row.id}-${column.key}`} className="px-2 py-2">
                      {column.key === 'stationName' ? (
                        <Link
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                          to={`/stations/${encodeURIComponent(row.stationId)}`}
                        >
                          {row.stationName}
                        </Link>
                      ) : (
                        renderValue(row[column.key])
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <Link
                      to={`/observations/${row.id}/edit`}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-2 py-8 text-center text-muted-foreground">
                    No weather rows matched this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Showing {rows.length.toLocaleString()} of {totalRows.toLocaleString()} rows.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-semibold">Page {page}</span>
            <Button
              variant="secondary"
              disabled={rows.length < pageSize || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Refreshing data...
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          Columns shown: {columns.map((column) => toTitleCase(column.label)).join(', ')}
        </p>
      </CardContent>
    </Card>
  )
}
