'use client'

import { useState, useTransition } from 'react'
import { saveSchedulingSlots } from '@/app/actions/schedule'

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

interface Slot {
  platform: string
  hour: number
  minute: number
}

interface SlotConfigProps {
  brandId: number
  initialSlots: Slot[]
  platforms: string[]
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function SlotConfig({ brandId, initialSlots, platforms }: SlotConfigProps) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [adding, setAdding] = useState<Record<string, { hour: string; minute: string }>>({})
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function getSlotsByPlatform(platform: string): Slot[] {
    return slots.filter(s => s.platform === platform)
  }

  function removeSlot(platform: string, hour: number, minute: number) {
    setSlots(prev => prev.filter(s => !(s.platform === platform && s.hour === hour && s.minute === minute)))
  }

  function startAdding(platform: string) {
    setAdding(prev => ({ ...prev, [platform]: { hour: '09', minute: '00' } }))
  }

  function cancelAdding(platform: string) {
    setAdding(prev => {
      const next = { ...prev }
      delete next[platform]
      return next
    })
  }

  function confirmAddSlot(platform: string) {
    const entry = adding[platform]
    if (!entry) return
    const hour = parseInt(entry.hour, 10)
    const minute = parseInt(entry.minute, 10)
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return

    // Prevent duplicate slots
    const exists = slots.some(s => s.platform === platform && s.hour === hour && s.minute === minute)
    if (!exists) {
      setSlots(prev => [...prev, { platform, hour, minute }].sort((a, b) => {
        if (a.platform !== b.platform) return a.platform.localeCompare(b.platform)
        if (a.hour !== b.hour) return a.hour - b.hour
        return a.minute - b.minute
      }))
    }

    cancelAdding(platform)
  }

  function handleSave() {
    setSaveStatus('idle')
    setErrorMsg('')
    startTransition(async () => {
      const result = await saveSchedulingSlots(brandId, slots)
      if (result.error) {
        setSaveStatus('error')
        setErrorMsg(result.error)
      } else {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    })
  }

  if (platforms.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          No connected social accounts found for this brand. Connect accounts to configure posting times.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Posting Schedule</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure when posts are automatically scheduled
        </p>
      </div>

      <div className="space-y-4">
        {platforms.map((platform) => {
          const platformSlots = getSlotsByPlatform(platform)
          const dotColor = PLATFORM_COLORS[platform.toLowerCase()] ?? '#6b7280'
          const isAdding = !!adding[platform]

          return (
            <div key={platform} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: dotColor, border: '1px solid rgba(255,255,255,0.2)' }}
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                />
                <span className="text-sm font-medium text-foreground capitalize">{platform}</span>
              </div>

              <div className="pl-4 space-y-2">
                {platformSlots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {platformSlots.map((slot) => (
                      <span
                        key={`${slot.hour}-${slot.minute}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        {formatTime(slot.hour, slot.minute)}
                        <button
                          type="button"
                          onClick={() => removeSlot(platform, slot.hour, slot.minute)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                          aria-label={`Remove ${formatTime(slot.hour, slot.minute)} slot`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {isAdding ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={adding[platform]?.hour}
                      onChange={e => setAdding(prev => ({ ...prev, [platform]: { ...prev[platform], hour: e.target.value } }))}
                      className="rounded border border-input bg-background text-foreground text-xs px-1.5 py-1 outline-none focus:ring-1 focus:ring-ring"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={String(i).padStart(2, '0')}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="text-muted-foreground text-xs">:</span>
                    <select
                      value={adding[platform]?.minute}
                      onChange={e => setAdding(prev => ({ ...prev, [platform]: { ...prev[platform], minute: e.target.value } }))}
                      className="rounded border border-input bg-background text-foreground text-xs px-1.5 py-1 outline-none focus:ring-1 focus:ring-ring"
                    >
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={String(m).padStart(2, '0')}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => confirmAddSlot(platform)}
                      className="rounded text-xs px-2 py-1 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelAdding(platform)}
                      className="rounded text-xs px-2 py-1 bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startAdding(platform)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <span className="text-base leading-none">+</span> Add time
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary text-primary-foreground text-sm px-4 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save Schedule'}
        </button>
        {saveStatus === 'saved' && (
          <span className="text-sm text-green-500">Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-sm text-destructive">{errorMsg || 'Save failed'}</span>
        )}
      </div>
    </div>
  )
}
