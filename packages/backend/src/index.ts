import { buildApp } from './app.js'
import { env } from './config/env.js'

const app = buildApp()
let isClosing = false

const closeServer = async (signal: NodeJS.Signals): Promise<void> => {
  if (isClosing) {
    return
  }

  isClosing = true
  app.log.info({ signal }, 'Received shutdown signal')

  try {
    await app.close()
    process.exit(0)
  } catch (error) {
    app.log.error(error, 'Failed during shutdown')
    process.exit(1)
  }
}

process.on('SIGINT', () => {
  void closeServer('SIGINT')
})

process.on('SIGTERM', () => {
  void closeServer('SIGTERM')
})

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: env.port, host: env.host })
  } catch (error) {
    app.log.error(error, 'Failed to start server')
    process.exit(1)
  }
}

await start()