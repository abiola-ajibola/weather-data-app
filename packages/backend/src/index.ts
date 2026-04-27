import Fastify from 'fastify'

const fastify = Fastify({ logger: true })

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

fastify.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await fastify.listen({ port, host })
  } catch (error) {
    fastify.log.error(error)
    process.exit(1)
  }
}

await start()