export type DashboardRange = '24h' | '7d' | '30d'

export type SortDirection = 'asc' | 'desc'

export type FilterOperator =
  | 'min-value'
  | 'max-value'
  | 'exact'
  | 'contains'
  | 'not'
  | 'is'
  | 'before'
  | 'after'
  | 'on'

export type WeatherFilter = {
  column: keyof WeatherObservationRow
  operator: FilterOperator
  value: string | number
}

export type WeatherObservationRow = {
  id: string
  stationId: string
  stationName: string
  date: string
  latitude: number | null
  longitude: number | null
  elevationM: number | null
  prcp: number | null
  prcpAttributes: string | null
  tmax: number | null
  tmaxAttributes: string | null
  tmin: number | null
  tminAttributes: string | null
  dapr: number | null
  daprAttributes: string | null
  datn: number | null
  datnAttributes: string | null
  datx: number | null
  datxAttributes: string | null
  dwpr: number | null
  dwprAttributes: string | null
  mdpr: number | null
  mdprAttributes: string | null
  mdtn: number | null
  mdtnAttributes: string | null
  mdtx: number | null
  mdtxAttributes: string | null
  tavg: number | null
  tavgAttributes: string | null
}

export type DashboardResponse = {
  range: DashboardRange
  topStations: Array<{ stationId: string; stationName: string; maxTmax: number }>
  conditionBreakdown: Array<{ condition: string; count: number; percentage: number }>
  rows: WeatherObservationRow[]
  page: number
  pageSize: number
  totalRows: number
}

export type StationObservationsResponse = {
  stationId: string
  rows: WeatherObservationRow[]
  page: number
  pageSize: number
  totalRows: number
}

export type StationAutocompleteResponse = {
  items: Array<{ stationId: string; name: string }>
}

export type WeatherRowListOptions = {
  page: number
  pageSize: number
  sortBy: keyof WeatherObservationRow
  sortDirection: SortDirection
  filters: WeatherFilter[]
}

export type ObservationPayload = Omit<WeatherObservationRow, 'id'>

export type ApiKeyItem = {
  id: string
  email: string
  label: string
  keyPrefix: string
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}
