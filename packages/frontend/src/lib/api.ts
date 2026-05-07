import type {
  CreateApiTokenResponse,
  DashboardRange,
  DashboardResponse,
  ObservationPayload,
  StationAutocompleteResponse,
  StationObservationsResponse,
  WeatherObservationRow,
  WeatherRowListOptions,
} from './types'

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ??
  'http://localhost:3001'

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

const createQuery = (params: Record<string, string | number | undefined>): string => {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value))
    }
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

const request = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
    if (import.meta.env.DEV) {
      headers.Authorization = `Bearer ${import.meta.env.VITE_API_KEY}`
    }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export const createApiToken = async (
  token: string,
  label: string,
): Promise<CreateApiTokenResponse> =>
  request('/auth/verify-link', {
    method: 'POST',
    body: { token, label },
  })

export const requestMagicLink = async (
  email: string,
): Promise<{ ok: boolean; expiresAt: string }> =>
  request('/auth/request-link', {
    method: 'POST',
    body: { email },
  })

export const fetchDashboard = async (
  range: DashboardRange,
  options: WeatherRowListOptions,
): Promise<DashboardResponse> =>
  request<DashboardResponse>(
    `/api/dashboard${createQuery({
      range,
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
      filters: options.filters.length > 0 ? JSON.stringify(options.filters) : undefined,
    })}`,
  )

export const fetchStationObservations = async (
  stationId: string,
  options: WeatherRowListOptions,
): Promise<StationObservationsResponse> =>
  request<StationObservationsResponse>(
    `/api/stations/${encodeURIComponent(stationId)}/observations${createQuery({
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
      filters: options.filters.length > 0 ? JSON.stringify(options.filters) : undefined,
    })}`,
  )

export const fetchStations = async (
  q: string,
): Promise<StationAutocompleteResponse> =>
  request<StationAutocompleteResponse>(
    `/api/stations${createQuery({ q: q.trim() || undefined })}`,
  )

export const fetchObservationById = async (
  id: string,
): Promise<{ item: WeatherObservationRow }> => request(`/api/observations/${id}`)

export const createObservation = async (
  payload: ObservationPayload,
): Promise<{ ok: boolean; item: WeatherObservationRow }> =>
  request('/api/observations', {
    method: 'POST',
    body: payload,
  })

export const updateObservation = async (
  id: string,
  payload: Partial<ObservationPayload>,
): Promise<{ ok: boolean; item: WeatherObservationRow }> =>
  request(`/api/observations/${id}`, {
    method: 'PUT',
    body: payload,
  })

export const deleteObservations = async (
  ids: string[],
): Promise<{ ok: boolean; count: number }> =>
  request('/api/observations', {
    method: 'DELETE',
    body: { ids },
  })

