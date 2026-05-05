import type { FastifyBaseLogger } from 'fastify'
import { createClient, type RedisClientType } from 'redis'

let client: RedisClientType | undefined

export const initCache = async (
  redisUrl: string | undefined,
  logger: FastifyBaseLogger,
): Promise<void> => {
  if (!redisUrl) {
    logger.info('Redis URL not provided. Caching is disabled.')
    return
  }

  client = createClient({ url: redisUrl })

  client.on('error', (error) => {
    logger.error({ error }, 'Redis client error')
  })

  try {
    await client.connect()
    logger.info('Redis cache connected')
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis. Continuing without cache.')
    client = undefined
  }
}

export const closeCache = async (): Promise<void> => {
  if (!client) {
    return
  }

  await client.quit()
  client = undefined
}

export const getCachedJson = async <T>(key: string): Promise<T | null> => {
  if (!client) {
    return null
  }

  const value = await client.get(key)
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export const setCachedJson = async (
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> => {
  if (!client) {
    return
  }

  await client.setEx(key, ttlSeconds, JSON.stringify(value))
}
