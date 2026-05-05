import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  fetchApiKeys,
  getApiKey,
  requestMagicLink,
  revokeApiKey,
  setApiKey,
  verifyMagicLink,
} from '@/lib/api'

export const AuthPage = () => {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [label, setLabel] = useState('My API key')
  const [requestMessage, setRequestMessage] = useState('')
  const [verifyMessage, setVerifyMessage] = useState('')

  const requestLinkMutation = useMutation({
    mutationFn: requestMagicLink,
    onSuccess: () => {
      setRequestMessage('Magic link sent. Check your email inbox.')
    },
  })

  const verifyLinkMutation = useMutation({
    mutationFn: ({
      verificationToken,
      keyLabel,
    }: {
      verificationToken: string
      keyLabel: string
    }) => verifyMagicLink(verificationToken, keyLabel),
    onSuccess: (result) => {
      setApiKey(result.apiKey)
      setVerifyMessage('API key created and saved in your browser.')
    },
  })

  const hasApiKey = getApiKey().length > 0

  const apiKeysQuery = useQuery({
    queryKey: ['api-keys'],
    enabled: hasApiKey,
    queryFn: fetchApiKeys,
  })

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await apiKeysQuery.refetch()
    },
  })

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Request magic link</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a one-time passwordless sign-in link.
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
          <CardTitle>Verify token and create API key</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste your token from the email link and create a named API key.
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
              verifyLinkMutation.isPending ||
              token.trim().length === 0 ||
              label.trim().length === 0
            }
            onClick={async () => {
              await verifyLinkMutation.mutateAsync({
                verificationToken: token.trim(),
                keyLabel: label.trim(),
              })
            }}
          >
            {verifyLinkMutation.isPending ? 'Creating...' : 'Create API key'}
          </Button>
          {verifyMessage ? <p className="text-sm text-primary">{verifyMessage}</p> : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Existing API keys</CardTitle>
          <p className="text-sm text-muted-foreground">
            API keys are scoped by email and can be revoked at any time.
          </p>
        </CardHeader>
        <CardContent>
          {!hasApiKey ? (
            <p className="text-sm text-muted-foreground">
              Create and save an API key first to list or revoke keys.
            </p>
          ) : (
            <div className="space-y-2">
              {(apiKeysQuery.data?.items ?? []).map((key) => (
                <div
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/70 p-3"
                >
                  <div>
                    <p className="font-semibold">{key.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {key.keyPrefix}... | Created {new Date(key.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    disabled={
                      revokeMutation.isPending ||
                      key.revokedAt !== null
                    }
                    onClick={async () => {
                      await revokeMutation.mutateAsync(key.id)
                    }}
                  >
                    {key.revokedAt ? 'Revoked' : 'Revoke'}
                  </Button>
                </div>
              ))}
              {(apiKeysQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No keys found yet.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
