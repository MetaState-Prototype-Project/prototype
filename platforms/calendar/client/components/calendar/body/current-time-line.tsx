'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { getCurrentTimeOffsetTop } from './day/calendar-body-margin-day-margin'

export function CurrentTimeLine() {
  const [now, setNow] = useState(new Date())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])
  
  const top = getCurrentTimeOffsetTop()

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: `${top}px`, transform: 'translateY(-50%)' }}
    >
      <div className="flex items-center shrink-0 bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded shadow-sm">
        {format(now, 'h:mm a')}
      </div>
      <div className="flex-1 h-0.5 bg-red-500 min-w-0" />
    </div>
  )
}

export { getCurrentTimeOffsetTop }
