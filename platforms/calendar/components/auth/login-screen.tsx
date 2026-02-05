'use client'

import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  calendarApi,
  getCalendarApiUrl,
  parseSessionFromUri,
} from '@/lib/calendar-api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginScreen() {
  const { login } = useAuth()
  const [uri, setUri] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const fetchOffer = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = getCalendarApiUrl()
      if (process.env.NODE_ENV === 'development') {
        console.log('[auth] fetching offer from', `${apiUrl}/api/auth/offer`)
      }
      const data = await calendarApi.getOffer()
      setUri(data.uri)
      const sid = data.sessionId ?? parseSessionFromUri(data.uri)
      setSessionId(sid ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load login')
      setUri('')
      setSessionId('')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOffer()
  }, [fetchOffer])

  useEffect(() => {
    if (!sessionId) return
    const apiUrl = getCalendarApiUrl()
    const eventSource = new EventSource(
      `${apiUrl}/api/auth/sessions/${sessionId}`
    )
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { token?: string }
        if (data.token) {
          setConnecting(true)
          login(data.token)
          eventSource.close()
        }
      } catch {
        // ignore parse errors
      }
    }
    eventSource.onerror = () => {
      eventSource.close()
    }
    return () => eventSource.close()
  }, [sessionId, login])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading login…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchOffer}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in with W3DS</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your eID Wallet to sign in. This app does not store your
            password; you keep control of your identity.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {connecting && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Signing in…
            </p>
          )}

          {/* Desktop: show QR code */}
          <div className="hidden flex-col items-center justify-center md:flex">
            <p className="text-muted-foreground mb-3 text-center text-sm">
              Scan with your eID Wallet app
            </p>
            {uri && (
              <div className="rounded-lg border bg-white p-4 dark:bg-neutral-900">
                <QRCodeSVG
                  value={uri}
                  size={220}
                  level="M"
                  includeMargin
                />
              </div>
            )}
          </div>

          {/* Mobile: show button */}
          <div className="flex flex-col gap-2 md:hidden">
            <p className="text-muted-foreground text-center text-sm">
              Open in your eID Wallet app
            </p>
            <Button asChild className="w-full" size="lg">
              <a href={uri} target="_blank" rel="noopener noreferrer">
                Open in eID Wallet
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
