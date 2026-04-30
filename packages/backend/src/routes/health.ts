import type { FastifyInstance } from 'fastify'

const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    timestamp: { type: 'string' },
  },
  required: ['status', 'timestamp'],
  additionalProperties: false,
} as const

export const registerHealthRoutes = async (
  fastify: FastifyInstance,
): Promise<void> => {
  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  )
}