import { useCalendarContext } from '../calendar-context'
import CalendarBodyDay from './day/calendar-body-day'
import CalendarBodyWeek from './week/calendar-body-week'
import CalendarBodyMonth from './month/calendar-body-month'

export default function CalendarBody() {
  const { mode } = useCalendarContext()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {mode === 'day' && <CalendarBodyDay />}
      {mode === 'week' && <CalendarBodyWeek />}
      {mode === 'month' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <CalendarBodyMonth />
        </div>
      )}
    </div>
  )
}
