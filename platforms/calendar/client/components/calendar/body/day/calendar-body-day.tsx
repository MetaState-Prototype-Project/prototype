'use client'

import { useEffect, useRef } from 'react'
import { isSameDay } from 'date-fns'
import CalendarBodyDayCalendar from './calendar-body-day-calendar'
import CalendarBodyDayEvents from './calendar-body-day-events'
import { useCalendarContext } from '../../calendar-context'
import CalendarBodyDayContent from './calendar-body-day-content'
import CalendarBodyMarginDayMargin from './calendar-body-margin-day-margin'
import CalendarBodyHeader from '../calendar-body-header'
import {
  CurrentTimeLine,
  getCurrentTimeOffsetTop,
} from '../current-time-line'
import {
  GRID_HEADER_HEIGHT,
  PIXELS_PER_HOUR,
} from './calendar-body-margin-day-margin'

const TOTAL_GRID_HEIGHT = 24 * PIXELS_PER_HOUR // Header is now outside the scrollable area

export default function CalendarBodyDay() {
  const { date } = useCalendarContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const showTimeline = isSameDay(date, new Date())

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
    <div className="flex divide-x flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Sticky: single day header */}
        <div className="flex shrink-0 border-b bg-background sticky top-0 z-30">
          <div className="w-12 shrink-0 bg-background" aria-hidden />
          <div className="flex-1 min-w-0">
            <CalendarBodyHeader date={date} />
          </div>
        </div>
        {/* Scrollable: time grid only */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          <div
            className="relative flex flex-1 divide-x"
            style={{ minHeight: TOTAL_GRID_HEIGHT }}
          >
            <CalendarBodyMarginDayMargin />
            <CalendarBodyDayContent date={date} hideHeader />
            {showTimeline && <CurrentTimeLine />}
          </div>
        </div>
      </div>
      <div className="lg:flex hidden flex-col flex-1 min-h-0 divide-y max-w-[276px] overflow-hidden">
        <CalendarBodyDayCalendar />
        <CalendarBodyDayEvents />
      </div>
    </div>
  )
}
