import type { CalendarProps } from './calendar-types'
import CalendarHeader from './header/calendar-header'
import CalendarBody from './body/calendar-body'
import CalendarHeaderActions from './header/actions/calendar-header-actions'
import CalendarHeaderDate from './header/date/calendar-header-date'
import CalendarHeaderActionsMode from './header/actions/calendar-header-actions-mode'
import CalendarHeaderActionsAdd from './header/actions/calendar-header-actions-add'
import CalendarProvider from './calendar-provider'

export default function Calendar({
  events,
  setEvents,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  refetchEvents,
}: CalendarProps) {
  return (
    <CalendarProvider
      events={events}
      setEvents={setEvents}
      mode={mode}
      setMode={setMode}
      date={date}
      setDate={setDate}
      calendarIconIsToday={calendarIconIsToday}
      refetchEvents={refetchEvents}
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0">
          <CalendarHeader>
            <CalendarHeaderDate />
            <CalendarHeaderActions>
              <CalendarHeaderActionsMode />
              <CalendarHeaderActionsAdd />
            </CalendarHeaderActions>
          </CalendarHeader>
        </div>
        <div className="flex-1 min-h-0">
          <CalendarBody />
        </div>
      </div>
    </CalendarProvider>
  )
}
