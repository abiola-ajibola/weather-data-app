import type {
  WeatherStationListResponse,
  WeatherStationSummary,
} from '../types/weather'

const DEFAULT_API_BASE_URL = 'http://localhost:3001'

type ListWeatherStationsOptions = {
  query?: string
  limit?: number
  signal?: AbortSignal
}

const getApiBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL
  return (configuredBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

const getApiKey = (): string | null => {
  const configuredApiKey = import.meta.env.VITE_WEATHER_API_KEY
  return configuredApiKey ? configuredApiKey.trim() : null
}

export const listWeatherStations = async (
  options: ListWeatherStationsOptions,
): Promise<WeatherStationListResponse> => {
  const apiUrl = new URL('/api/weather/stations', `${getApiBaseUrl()}/`)

  if (options.query) {
    apiUrl.searchParams.set('q', options.query)
  }

  if (options.limit) {
    apiUrl.searchParams.set('limit', String(options.limit))
  }

  const apiKey = getApiKey()
  const headers: HeadersInit = apiKey ? { 'x-api-key': apiKey } : {}

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers,
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to load stations: ${response.status}`)
  }

  const payload = (await response.json()) as {
    items?: WeatherStationSummary[]
    total?: number
  }

  return {
    items: payload.items ?? [],
    total: payload.total ?? 0,
  }
}