import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createApiToken, requestMagicLink } from '@/lib/api'

export const AuthPage = () => {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [label, setLabel] = useState('My API key')
  const [requestMessage, setRequestMessage] = useState('')
  const [verifyMessage, setVerifyMessage] = useState('')
  const [createdToken, setCreatedToken] = useState('')

  const requestLinkMutation = useMutation({
    mutationFn: requestMagicLink,
    onSuccess: () => {
      setRequestMessage('Magic link sent. Check your email inbox.')
    },
  })

  const createTokenMutation = useMutation({
    mutationFn: ({
      verificationToken,
      keyLabel,
    }: {
      verificationToken: string
      keyLabel: string
    }) => createApiToken(verificationToken, keyLabel),
    onSuccess: (result) => {
      setCreatedToken(result.apiKey)
      setVerifyMessage('Token created after email verification. Existing tokens for this email were revoked.')
    },
  })

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Request magic link</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a one-time link for token generation.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
          <Button
            disabled={requestLinkMutation.isPending || email.trim().length === 0}
            onClick={async () => {
              await requestLinkMutation.mutateAsync(email.trim())
            }}
          >
            {requestLinkMutation.isPending ? 'Sending...' : 'Send magic link'}
          </Button>
          {requestMessage ? <p className="text-sm text-primary">{requestMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verify magic link and create token</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste the token from your email link to create an API token.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Magic link token"
          />
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Key label"
          />
          <Button
            disabled={
              createTokenMutation.isPending ||
              token.trim().length === 0 ||
              label.trim().length === 0
            }
            onClick={async () => {
              await createTokenMutation.mutateAsync({
                verificationToken: token.trim(),
                keyLabel: label.trim(),
              })
            }}
          >
            {createTokenMutation.isPending ? 'Creating...' : 'Create API token'}
          </Button>
          {verifyMessage ? <p className="text-sm text-primary">{verifyMessage}</p> : null}
          {createdToken ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold">Generated token</p>
              <Input value={createdToken} readOnly />
              <p className="text-xs text-muted-foreground">
                Use this token in your proxy server configuration.
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Creating a new token with the same email automatically revokes older active tokens.
          </p>
          <p className="text-xs text-muted-foreground">
            Tokens are also revoked after 30 days of inactivity.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
