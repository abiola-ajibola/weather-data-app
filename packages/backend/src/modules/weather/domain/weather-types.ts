export type WeatherStationSummary = {
  stationId: string
  name: string
  regionCode: string
  latitude: number
  longitude: number
  elevationM: number
  recordCount: number
}

export type WeatherStationFilters = {
  query?: string
  limit: number
}

export type WeatherStationRepository = {
  listStationSummaries: () => Promise<WeatherStationSummary[]>
}