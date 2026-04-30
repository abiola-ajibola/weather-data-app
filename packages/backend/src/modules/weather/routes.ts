import type { FastifyInstance } from 'fastify'

import { WeatherService } from './application/weather-service.js'
import { PrismaWeatherRepository } from './infrastructure/prisma-weather-repository.js'
import {
  weatherStationListQuerySchema,
  weatherStationListResponseSchema,
} from './schemas.js'

type WeatherStationListQuery = {
  q?: string
  limit?: number
}

const weatherService = new WeatherService(new PrismaWeatherRepository())

export const registerWeatherRoutes = async (
  fastify: FastifyInstance,
): Promise<void> => {
  fastify.get<{
    Querystring: WeatherStationListQuery
  }>(
    '/stations',
    {
      schema: {
        querystring: weatherStationListQuerySchema,
        response: {
          200: weatherStationListResponseSchema,
        },
      },
    },
    async (request) => {
      const items = await weatherService.listStations({
        query: request.query.q,
        limit: request.query.limit ?? 20,
      })

      return {
        items,
        total: items.length,
      }
    },
  )
}