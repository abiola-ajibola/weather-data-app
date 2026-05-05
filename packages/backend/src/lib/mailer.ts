import nodemailer, { type Transporter } from 'nodemailer'

import { env } from '../config/env.js'

type MagicLinkPayload = {
  email: string
  magicLinkUrl: string
  expiresInMinutes: number
}

const createTransporter = (): Transporter => {
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    return nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    })
  }

  // Development fallback: print the email content to logs.
  return nodemailer.createTransport({ jsonTransport: true })
}

const transporter = createTransporter()

export const sendMagicLinkEmail = async ({
  email,
  magicLinkUrl,
  expiresInMinutes,
}: MagicLinkPayload): Promise<void> => {
  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: 'Your Weather Data App sign-in link',
    text: `Use this one-time link to create an API key: ${magicLinkUrl}\n\nThe link expires in ${expiresInMinutes} minutes.`,
    html: `<p>Use this one-time link to create an API key:</p><p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p><p>The link expires in ${expiresInMinutes} minutes.</p>`,
  })
}
