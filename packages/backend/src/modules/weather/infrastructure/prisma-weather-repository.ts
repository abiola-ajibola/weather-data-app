import { prisma } from "@weather-data-app/database";

import type {
  WeatherStationRepository,
  WeatherStationSummary,
} from "../domain/weather-types.js";

export class PrismaWeatherRepository implements WeatherStationRepository {
  public async listStationSummaries(): Promise<WeatherStationSummary[]> {
    const stations = await prisma.weatherStation.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            observations: true,
          },
        },
      },
    });

    return stations.map((station) => ({
      stationId: station.stationId,
      name: station.name,
      regionCode: station.regionCode,
      latitude: station.latitude,
      longitude: station.longitude,
      elevationM: station.elevationM,
      recordCount: station._count.observations,
    }));
  }
}
