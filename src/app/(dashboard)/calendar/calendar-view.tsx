'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg, EventContentArg } from '@fullcalendar/core'
import { reschedulePost } from '@/app/actions/schedule'
import type { CalendarEvent } from '@/app/actions/schedule'

const PLATFORM_COLORS: Record<string, string> = {
  x:         '#ffffff',
  twitter:   '#ffffff',
  instagram: '#E1306C',
  linkedin:  '#0077B5',
  tiktok:    '#010101',
  facebook:  '#1877F2',
  threads:   '#ffffff',
  reddit:    '#FF4500',
  bluesky:   '#0085FF',
}

const STATUS_ICONS: Record<string, string> = {
  published: '✓',
  scheduled: '◷',
  failed:    '✕',
}

function renderEventContent(arg: EventContentArg) {
  const { event, view } = arg
  const platforms: string[] = event.extendedProps?.platforms ?? []
  const status: string = event.extendedProps?.status ?? 'scheduled'
  const isWeekView = view.type === 'timeGridWeek'

  return (
    <div className="fc-event-inner" style={{ overflow: 'hidden', padding: '2px 4px' }}>
      {isWeekView && (
        <div style={{ fontSize: '0.65rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
          {arg.timeText}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', minWidth: 0 }}>
        <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>
          {STATUS_ICONS[status] ?? '◷'}
        </span>
        <span style={{
          fontSize: '0.7rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {event.title}
        </span>
      </div>
      {platforms.length > 0 && (
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '2px' }}>
          {platforms.map((platform) => (
            <span
              key={platform}
              title={platform}
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: PLATFORM_COLORS[platform.toLowerCase()] ?? '#6b7280',
                border: '1px solid rgba(255,255,255,0.3)',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CalendarViewProps {
  events: CalendarEvent[]
}

export function CalendarView({ events }: CalendarViewProps) {
  async function handleEventDrop(arg: EventDropArg) {
    const postId = Number(arg.event.id)
    const newStart = arg.event.start

    if (!newStart || isNaN(postId)) {
      arg.revert()
      return
    }

    const result = await reschedulePost(postId, newStart.toISOString())
    if (result.error) {
      console.error('Failed to reschedule post:', result.error)
      arg.revert()
    }
  }

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek',
      }}
      events={events}
      editable={true}
      eventDrop={handleEventDrop}
      eventContent={renderEventContent}
      height="auto"
      nowIndicator={true}
    />
  )
}
