import type { FastifyInstance } from 'fastify'

import { registerHealthRoutes } from './health.js'
import { registerWeatherRoutes } from '../modules/weather/routes.js'

export const registerRoutes = async (fastify: FastifyInstance): Promise<void> => {
  await fastify.register(registerHealthRoutes)
  await fastify.register(registerWeatherRoutes, { prefix: '/api/weather' })
}