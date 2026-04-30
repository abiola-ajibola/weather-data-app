export const weatherStationListQuerySchema = {
  type: 'object',
  properties: {
    q: { type: 'string', minLength: 1, maxLength: 80 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  additionalProperties: false,
} as const

export const weatherStationListResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stationId: { type: 'string' },
          name: { type: 'string' },
          regionCode: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          elevationM: { type: 'number' },
          recordCount: { type: 'integer' },
        },
        required: [
          'stationId',
          'name',
          'regionCode',
          'latitude',
          'longitude',
          'elevationM',
          'recordCount',
        ],
        additionalProperties: false,
      },
    },
    total: { type: 'integer' },
  },
  required: ['items', 'total'],
  additionalProperties: false,
} as const