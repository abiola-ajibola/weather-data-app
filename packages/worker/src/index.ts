import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

import { prisma } from '@weather-data-app/database'
import { parse } from 'csv-parse'

type CsvRow = {
  STATION?: string
  DATE?: string
  LATITUDE?: string
  LONGITUDE?: string
  ELEVATION?: string
  NAME?: string
  PRCP?: string
  TAVG?: string
  TMAX?: string
  TMIN?: string
}

type StationPayload = {
  stationId: string
  name: string
  regionCode: string
  latitude: number
  longitude: number
  elevationM: number
}

type ObservationPayload = {
  stationId: string
  date: Date
  precipitationMm: number | null
  tempAvgC: number | null
  tempMaxC: number | null
  tempMinC: number | null
}

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const datasetDirectory =
  process.env.WEATHER_DATASET_DIR ??
  resolve(sourceDirectory, '../../../sample-dataset')
const createManyChunkSize = 2000

const toNumber = (value: string | undefined): number => {
  const parsed = Number(value?.trim())
  return Number.isFinite(parsed) ? parsed : 0
}

const toScaledNumber = (value: string | undefined): number | null => {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    return null
  }

  const parsed = Number(normalizedValue)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.round(parsed) / 10
}

const toDate = (value: string | undefined): Date => {
  if (!value) {
    throw new Error('Missing DATE column value in CSV row')
  }

  return new Date(`${value}T00:00:00.000Z`)
}

const extractRegionCode = (stationName: string): string => {
  const parts = stationName.split(',').map((part) => part.trim())
  return parts.length > 1 ? parts[parts.length - 1] : 'Unknown'
}

const splitIntoChunks = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

const ingestStationFile = async (filePath: string): Promise<void> => {
  const stationPayloads: StationPayload[] = []
  const observations: ObservationPayload[] = []

  await pipeline(
    createReadStream(filePath),
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }),
    async function* normalizeRows(
      source: AsyncIterable<CsvRow>,
    ): AsyncGenerator<ObservationPayload> {
      for await (const row of source) {
        const stationId = row.STATION?.trim()
        const stationName = row.NAME?.trim()

        if (!stationId || !stationName) {
          continue
        }

        if (stationPayloads.length === 0) {
          stationPayloads.push({
            stationId,
            name: stationName,
            regionCode: extractRegionCode(stationName),
            latitude: toNumber(row.LATITUDE),
            longitude: toNumber(row.LONGITUDE),
            elevationM: toNumber(row.ELEVATION),
          })
        }

        yield {
          stationId,
          date: toDate(row.DATE),
          precipitationMm: toScaledNumber(row.PRCP),
          tempAvgC: toScaledNumber(row.TAVG),
          tempMaxC: toScaledNumber(row.TMAX),
          tempMinC: toScaledNumber(row.TMIN),
        }
      }
    },
    async function collectRows(source: AsyncIterable<ObservationPayload>) {
      for await (const observation of source) {
        observations.push(observation)
      }
    },
  )

  const station = stationPayloads[0]

  if (!station) {
    return
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.weatherStation.upsert({
      where: {
        stationId: station.stationId,
      },
      create: station,
      update: {
        name: station.name,
        regionCode: station.regionCode,
        latitude: station.latitude,
        longitude: station.longitude,
        elevationM: station.elevationM,
      },
    })

    await transaction.weatherObservation.deleteMany({
      where: {
        stationId: station.stationId,
      },
    })

    for (const chunk of splitIntoChunks(observations, createManyChunkSize)) {
      await transaction.weatherObservation.createMany({
        data: chunk,
      })
    }
  })

  console.log(
    `Ingested ${observations.length} observations for station ${station.stationId}`,
  )
}

const run = async (): Promise<void> => {
  const files = (await readdir(datasetDirectory))
    .filter((fileName) => fileName.endsWith('.csv'))
    .sort((left, right) => left.localeCompare(right))

  if (files.length === 0) {
    throw new Error(`No CSV files found in ${datasetDirectory}`)
  }

  for (const fileName of files) {
    const filePath = join(datasetDirectory, fileName)
    await ingestStationFile(filePath)
  }

  await prisma.$disconnect()
  console.log('Weather ingestion completed successfully.')
}

run().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
