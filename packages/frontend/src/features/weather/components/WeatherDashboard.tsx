import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useWeatherStations } from '../hooks/use-weather-stations'

const DEBOUNCE_DELAY_MS = 300

export function WeatherDashboard() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, DEBOUNCE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  const { stations, total, isLoading, errorMessage } = useWeatherStations({
    query: debouncedSearchTerm || undefined,
    limit: 25,
  })

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Stations
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Weather Source Registry
          </h2>
        </div>
        <p className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Total {total}
        </p>
      </div>

      <label className="mt-5 flex items-center gap-3 rounded-2xl border border-border px-4 py-3 focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value)
          }}
          placeholder="Search station name, id, or region"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
          Loading stations from backend...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span>Station</span>
            <span>Region</span>
            <span>Records</span>
            <span>Coordinates</span>
          </div>

          {stations.map((station) => (
            <div
              key={station.stationId}
              className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr] gap-3 border-b border-border px-4 py-4 text-sm text-foreground last:border-b-0"
            >
              <div>
                <p className="font-semibold">{station.name}</p>
                <p className="text-xs text-muted-foreground">{station.stationId}</p>
              </div>
              <span>{station.regionCode}</span>
              <span>{station.recordCount}</span>
              <span>
                {station.latitude.toFixed(2)}, {station.longitude.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}