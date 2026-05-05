import type { FastifyInstance } from 'fastify'

import { prisma } from '@weather-data-app/database'

import { env } from '../config/env.js'
import {
  apiKeyPrefix,
  generateApiKey,
  generateMagicLinkToken,
  hashToken,
  isEmailLike,
  normalizeEmail,
} from '../lib/auth.js'
import { sendMagicLinkEmail } from '../lib/mailer.js'

const requestLinkBodySchema = {
  type: 'object',
  required: ['email'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', minLength: 5, maxLength: 320 },
  },
} as const

const verifyLinkBodySchema = {
  type: 'object',
  required: ['token', 'label'],
  additionalProperties: false,
  properties: {
    token: { type: 'string', minLength: 12, maxLength: 256 },
    label: { type: 'string', minLength: 2, maxLength: 80 },
  },
} as const

export const registerAuthRoutes = async (
  fastify: FastifyInstance,
): Promise<void> => {
  fastify.post(
    '/auth/request-link',
    {
      schema: {
        body: requestLinkBodySchema,
      },
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60_000,
        },
      },
    },
    async (request) => {
      const body = request.body as { email: string }
      const email = normalizeEmail(body.email)

      if (!isEmailLike(email)) {
        throw fastify.httpErrors.badRequest('A valid email is required.')
      }

      const token = generateMagicLinkToken()
      const tokenHash = hashToken(token)
      const expiresAt = new Date(
        Date.now() + env.magicLinkTtlMinutes * 60 * 1000,
      )

      await prisma.magicLinkToken.create({
        data: {
          email,
          tokenHash,
          expiresAt,
        },
      })

      const magicLinkUrl = `${env.magicLinkBaseUrl}?token=${encodeURIComponent(token)}`

      await sendMagicLinkEmail({
        email,
        magicLinkUrl,
        expiresInMinutes: env.magicLinkTtlMinutes,
      })

      return {
        ok: true,
        expiresAt: expiresAt.toISOString(),
      }
    },
  )

  fastify.post(
    '/auth/verify-link',
    {
      schema: {
        body: verifyLinkBodySchema,
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: 60_000,
        },
      },
    },
    async (request) => {
      const body = request.body as { token: string; label: string }
      const tokenHash = hashToken(body.token.trim())
      const label = body.label.trim()

      const tokenRecord = await prisma.magicLinkToken.findUnique({
        where: {
          tokenHash,
        },
      })

      if (
        !tokenRecord ||
        tokenRecord.consumedAt ||
        tokenRecord.expiresAt.getTime() <= Date.now()
      ) {
        throw fastify.httpErrors.unauthorized('The magic link is invalid or expired.')
      }

      const apiKey = generateApiKey()
      const keyHash = hashToken(apiKey)

      const createdKey = await prisma.apiKey.create({
        data: {
          email: tokenRecord.email,
          label,
          keyHash,
          keyPrefix: apiKeyPrefix(apiKey),
        },
      })

      await prisma.magicLinkToken.update({
        where: {
          id: tokenRecord.id,
        },
        data: {
          consumedAt: new Date(),
        },
      })

      return {
        ok: true,
        apiKey,
        keyId: createdKey.id,
        email: createdKey.email,
        label: createdKey.label,
        keyPrefix: createdKey.keyPrefix,
      }
    },
  )

  fastify.get('/auth/api-keys', async (request) => {
    if (!request.authEmail) {
      throw fastify.httpErrors.unauthorized('Missing auth context.')
    }

    const keys = await prisma.apiKey.findMany({
      where: {
        email: request.authEmail,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      items: keys.map((key) => ({
        id: key.id,
        email: key.email,
        label: key.label,
        keyPrefix: key.keyPrefix,
        createdAt: key.createdAt.toISOString(),
        revokedAt: key.revokedAt?.toISOString() ?? null,
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      })),
    }
  })

  fastify.delete('/auth/api-keys/:id', async (request) => {
    if (!request.authEmail) {
      throw fastify.httpErrors.unauthorized('Missing auth context.')
    }

    const { id } = request.params as { id: string }

    const key = await prisma.apiKey.findUnique({ where: { id } })

    if (!key || key.email !== request.authEmail) {
      throw fastify.httpErrors.notFound('API key not found.')
    }

    await prisma.apiKey.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    })

    return { ok: true }
  })
}
