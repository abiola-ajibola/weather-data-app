import type { ApiKey } from '@weather-data-app/database'

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey
    authEmail?: string
  }
}
