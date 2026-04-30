import { useEffect, useState } from 'react'

import { listWeatherStations } from '../api/weather-api'
import type { WeatherStationSummary } from '../types/weather'

type UseWeatherStationsOptions = {
  query?: string
  limit?: number
}

type UseWeatherStationsState = {
  stations: WeatherStationSummary[]
  total: number
  isLoading: boolean
  errorMessage: string | null
}

const DEFAULT_LIMIT = 20

export const useWeatherStations = (
  options: UseWeatherStationsOptions,
): UseWeatherStationsState => {
  const [stations, setStations] = useState<WeatherStationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const abortController = new AbortController()

    setIsLoading(true)
    setErrorMessage(null)

    void listWeatherStations({
      query: options.query,
      limit: options.limit ?? DEFAULT_LIMIT,
      signal: abortController.signal,
    })
      .then((payload) => {
        setStations(payload.items)
        setTotal(payload.total)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setStations([])
        setTotal(0)
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load stations.',
        )
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [options.limit, options.query])

  return {
    stations,
    total,
    isLoading,
    errorMessage,
  }
}