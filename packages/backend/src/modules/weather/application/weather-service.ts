import type {
  WeatherStationFilters,
  WeatherStationRepository,
  WeatherStationSummary,
} from '../domain/weather-types.js'

export class WeatherService {
  private readonly repository: WeatherStationRepository
  private cachePromise: Promise<WeatherStationSummary[]> | null = null

  public constructor(repository: WeatherStationRepository) {
    this.repository = repository
  }

  public async listStations(
    filters: WeatherStationFilters,
  ): Promise<WeatherStationSummary[]> {
    const normalizedQuery = filters.query?.trim().toLowerCase()
    const limit = Math.max(1, filters.limit)
    const stations = await this.getCachedStations()

    const matchingStations = normalizedQuery
      ? stations.filter((station) => {
          return [station.stationId, station.name, station.regionCode].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          )
        })
      : stations

    return matchingStations.slice(0, limit)
  }

  private async getCachedStations(): Promise<WeatherStationSummary[]> {
    if (!this.cachePromise) {
      this.cachePromise = this.repository.listStationSummaries()
    }

    return this.cachePromise
  }
}