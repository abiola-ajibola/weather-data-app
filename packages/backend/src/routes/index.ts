import type { FastifyInstance } from 'fastify'

import { registerHealthRoutes } from './health.js'

export const registerRoutes = async (fastify: FastifyInstance): Promise<void> => {
  await fastify.register(registerHealthRoutes)
}