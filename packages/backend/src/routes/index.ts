import type { FastifyInstance } from 'fastify'

import { registerAuthRoutes } from './auth.js'
import { registerHealthRoutes } from './health.js'
import { registerWeatherRoutes } from './weather.js'

export const registerRoutes = async (fastify: FastifyInstance): Promise<void> => {
  await fastify.register(registerHealthRoutes)
  await fastify.register(registerAuthRoutes)
  await fastify.register(registerWeatherRoutes)
}