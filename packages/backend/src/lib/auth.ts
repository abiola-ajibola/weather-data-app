import { createHash, randomBytes } from 'node:crypto'

export const hashToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex')

export const generateMagicLinkToken = (): string => randomBytes(24).toString('hex')

export const generateApiKey = (): string =>
  `wda_${randomBytes(24).toString('hex')}`

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export const isEmailLike = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export const apiKeyPrefix = (apiKey: string): string => apiKey.slice(0, 12)
