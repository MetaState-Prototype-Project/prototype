import { useCalendarContext } from '../../calendar-context'
import { isSameDay } from 'date-fns'
import { hours } from './calendar-body-margin-day-margin'
import CalendarBodyHeader from '../calendar-body-header'
import CalendarEvent from '../../calendar-event'

export default function CalendarBodyDayContent({
  date,
  hideHeader = false,
}: {
  date: Date
  hideHeader?: boolean
}) {
  const { events } = useCalendarContext()

  const dayEvents = events.filter((event) => isSameDay(event.start, date))

  return (
    <div className="flex flex-col flex-grow min-h-0">
      {!hideHeader && <CalendarBodyHeader date={date} />}

      <div className="flex-1 relative min-h-0">
        {hours.map((hour) => (
          <div key={hour} className="h-32 border-b border-border/50 group" />
        ))}

        {dayEvents.map((event) => (
          <CalendarEvent key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
