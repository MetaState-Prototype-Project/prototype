'use client'

import { useCallback, useEffect, useState } from 'react'
import Calendar from './calendar/calendar'
import { CalendarEvent, Mode } from './calendar/calendar-types'
import { useAuth } from '@/contexts/auth-context'
import LoginScreen from '@/components/auth/login-screen'
import { calendarApi } from '@/lib/calendar-api'

function mapApiToEvent(e: {
  id: string
  title: string
  color: string
  start: string
  end: string
}): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    color: e.color || 'blue',
    start: new Date(e.start),
    end: new Date(e.end),
  }
}

export default function CalendarDemo() {
  const { isAuthenticated, isReady } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [mode, setMode] = useState<Mode>('month')
  const [date, setDate] = useState<Date>(new Date())
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const refetchEvents = useCallback(async () => {
    if (!isAuthenticated) return
    setEventsLoading(true)
    setEventsError(null)
    try {
      const list = await calendarApi.getEvents()
      setEvents(list.map(mapApiToEvent))
    } catch (e) {
      setEventsError(e instanceof Error ? e.message : 'Failed to load events')
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) refetchEvents()
  }, [isAuthenticated, refetchEvents])

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <>
      {eventsLoading && events.length === 0 && (
        <div className="flex justify-center p-4">
          <p className="text-muted-foreground">Loading events…</p>
        </div>
      )}
      {eventsError && (
        <div className="bg-destructive/10 text-destructive mx-4 rounded-md p-3 text-sm">
          {eventsError}
        </div>
      )}
      <Calendar
        events={events}
        setEvents={setEvents}
        mode={mode}
        setMode={setMode}
        date={date}
        setDate={setDate}
        refetchEvents={refetchEvents}
      />
    </>
  )
}
