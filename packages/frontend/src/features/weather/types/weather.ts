export type WeatherStationSummary = {
  stationId: string
  name: string
  regionCode: string
  latitude: number
  longitude: number
  elevationM: number
  recordCount: number
}

export type WeatherStationListResponse = {
  items: WeatherStationSummary[]
  total: number
}