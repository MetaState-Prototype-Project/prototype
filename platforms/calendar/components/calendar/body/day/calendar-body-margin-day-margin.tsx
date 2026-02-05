import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export const hours = Array.from({ length: 24 }, (_, i) => i)
export const PIXELS_PER_HOUR = 128
export const GRID_HEADER_HEIGHT = 48 // Legacy: for calculating total grid height

export function getCurrentTimeOffsetTop(): number {
  const now = new Date()
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
  // Header is now outside the scrollable area, so start from 0
  return hours * PIXELS_PER_HOUR
}

export default function CalendarBodyMarginDayMargin({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky left-0 w-12 bg-background z-10 flex flex-col',
        className
      )}
    >
      {hours.map((hour) => (
        <div key={hour} className="relative h-32 first:mt-0">
          {hour !== 0 && (
            <span className="absolute text-xs text-muted-foreground -top-2.5 left-2">
              {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
