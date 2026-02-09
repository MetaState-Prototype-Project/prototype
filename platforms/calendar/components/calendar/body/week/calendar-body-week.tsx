'use client'

import { useEffect, useRef } from 'react'
import { useCalendarContext } from '../../calendar-context'
import { startOfWeek, addDays, isSameDay } from 'date-fns'
import CalendarBodyMarginDayMargin from '../day/calendar-body-margin-day-margin'
import CalendarBodyDayContent from '../day/calendar-body-day-content'
import CalendarBodyHeader from '../calendar-body-header'
import {
  CurrentTimeLine,
  getCurrentTimeOffsetTop,
} from '../current-time-line'
import {
  GRID_HEADER_HEIGHT,
  PIXELS_PER_HOUR,
} from '../day/calendar-body-margin-day-margin'

const TOTAL_GRID_HEIGHT = 24 * PIXELS_PER_HOUR // Header is now outside the scrollable area

export default function CalendarBodyWeek() {
  const { date } = useCalendarContext()
  const scrollRef = useRef<HTMLDivElement>(null)

  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()
  const showTimeline = weekDays.some((day) => isSameDay(day, today))

  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const scrollToCenter = () => {
      if (!el.clientHeight || !el.scrollHeight) return
      const top = getCurrentTimeOffsetTop()
      const center = el.clientHeight / 2
      const scrollTop = Math.max(
        0,
        Math.min(top - center, el.scrollHeight - el.clientHeight)
      )
      el.scrollTop = scrollTop
    }
    
    // Try multiple times to ensure DOM is ready
    const timeouts: NodeJS.Timeout[] = []
    timeouts.push(setTimeout(scrollToCenter, 0))
    timeouts.push(setTimeout(scrollToCenter, 50))
    timeouts.push(setTimeout(scrollToCenter, 150))
    
    return () => timeouts.forEach(clearTimeout)
  }, [showTimeline, date])

  return (
    <div className="flex flex-col flex-1 min-h-0 divide-x overflow-hidden">
      {/* Sticky: day headers row */}
      <div className="flex shrink-0 border-b bg-background sticky top-0 z-30">
        <div className="w-12 shrink-0 hidden md:block bg-background" aria-hidden />
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="flex-1 min-w-0">
            <CalendarBodyHeader date={day} />
          </div>
        ))}
      </div>
      {/* Scrollable: time grid only */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div
          className="relative flex divide-x flex-col md:flex-row"
          style={{ minHeight: TOTAL_GRID_HEIGHT }}
        >
          <CalendarBodyMarginDayMargin className="hidden md:block" />
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="flex flex-1 divide-x md:divide-x-0"
            >
              <CalendarBodyMarginDayMargin className="block md:hidden" />
              <CalendarBodyDayContent date={day} hideHeader />
            </div>
          ))}
          {showTimeline && <CurrentTimeLine />}
        </div>
      </div>
    </div>
  )
}
