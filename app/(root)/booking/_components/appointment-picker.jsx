'use client'

import { getBookableDates, getBookingSlots } from '@/actions/bookingSlot.action'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

/* ---------- date helpers ---------- */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return startOfDay(x)
}
function formatYMD(date) {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function parseYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function isSameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/* ---------- delivery badge ---------- */
// Earlier windows ship next day (24h); later windows ship in 48h.
function turnHours(startTime) {
  const hour = Number((startTime || '13:00').split(':')[0])
  return hour < 13 ? '24' : '48'
}
function badgeSrc(startTime, state) {
  return `/images/booking/badge-${turnHours(startTime)}-${state}.svg`
}

/* "09:00" -> "9:00" */
function fmt(hhmm) {
  if (!hhmm) return ''
  const [hh, mm] = hhmm.split(':')
  return `${Number(hh)}:${mm}`
}

/**
 * Figma-faithful appointment picker: a horizontal week strip + a 3-column
 * grid of one-hour windows badged with their delivery turnaround.
 * Calls onSelect({ date: "YYYY-MM-DD", time: "HH:MM", label }).
 */
export default function AppointmentPicker({
  value,
  onSelect,
  autoSelectSlot = true,
  // Delivery turnaround labels only make sense in the order flow; the
  // telephone-only /booking page passes false.
  showTurnaround = true,
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [weekStart, setWeekStart] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [bookableStrings, setBookableStrings] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [autoSelected, setAutoSelected] = useState(false)

  const bookableDates = useMemo(
    () => bookableStrings.map(parseYMD),
    [bookableStrings],
  )

  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const monthLabel = useMemo(
    () =>
      week[0].toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    [week],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getBookableDates()
        if (!res?.success) {
          toast.error(res?.msg || 'Failed to load available days.')
          return
        }
        setBookableStrings(res.data || [])
      } catch (err) {
        console.error(err)
        toast.error('Could not load available days.')
      }
    })()
  }, [])

  function isBookable(date) {
    if (date < today) return false
    return bookableDates.some((d) => isSameDay(d, date))
  }

  // If today is not bookable (e.g. all slots full/past), auto-select first available bookable day
  useEffect(() => {
    if (!bookableDates.length) return
    const isTodayBookable = bookableDates.some((d) => isSameDay(d, today))
    if (!isTodayBookable) {
      const firstBookable = bookableDates.find((d) => d >= today)
      if (firstBookable) {
        setSelectedDate(firstBookable)
        setWeekStart(firstBookable)
      }
    }
  }, [bookableDates, today])

  const selectedIsBookable = isBookable(selectedDate)

  useEffect(() => {
    ;(async () => {
      if (!selectedIsBookable) {
        setTimeSlots([])
        return
      }
      setLoadingSlots(true)
      try {
        const res = await getBookingSlots(formatYMD(selectedDate))
        setTimeSlots(res?.success ? res.data || [] : [])
        if (!res?.success) toast.error(res?.msg || 'Failed to load slots')
      } catch (err) {
        console.error(err)
        setTimeSlots([])
      } finally {
        setLoadingSlots(false)
      }
    })()
  }, [selectedDate, selectedIsBookable])

  const isToday = isSameDay(selectedDate, today)
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const slots = useMemo(
    () =>
      timeSlots.map((s) => {
        const [h, m] = (s.startTime || '0:0').split(':').map(Number)
        return { ...s, isPast: isToday && h * 60 + m <= nowMins }
      }),
    [timeSlots, isToday, nowMins],
  )

  // Hide slots that are already full or past
  const visibleSlots = useMemo(
    () => slots.filter((s) => !s.isPast && !s.isFull),
    [slots]
  )

  // Default: pre-select the next available slot on the next available day.
  useEffect(() => {
    if (autoSelected || value) return
    if (loadingSlots || !bookableStrings.length) return

    const avail = slots.find((s) => !s.isPast && !s.isFull)
    if (avail) {
      // Keep navigating to a day that HAS availability, but only pre-select a
      // time slot when autoSelectSlot is enabled. When disabled, the user must
      // pick a time themselves (so they can't skip the step without choosing).
      if (autoSelectSlot) {
        onSelect?.({
          date: formatYMD(selectedDate),
          time: avail.startTime,
          endTime: avail.endTime,
          label: avail.label,
        })
      }
      setAutoSelected(true)
      return
    }

    // No slot on this day → jump to the next bookable day.
    const next = bookableDates
      .filter((d) => d > selectedDate)
      .sort((a, b) => a - b)[0]
    if (next) {
      setSelectedDate(next)
      if (next >= addDays(weekStart, 7)) setWeekStart(next)
    } else {
      setAutoSelected(true) // nothing available anywhere
    }
  }, [
    slots,
    loadingSlots,
    autoSelected,
    value,
    bookableStrings,
    bookableDates,
    selectedDate,
    weekStart,
    onSelect,
    autoSelectSlot,
  ])

  function pickSlot(s) {
    if (s.isPast || s.isFull) return
    onSelect?.({
      date: formatYMD(selectedDate),
      time: s.startTime,
      endTime: s.endTime,
      label: s.label,
    })
  }

  return (
    <div className='flex flex-col items-center lg:items-stretch gap-6'>
      {/* Calendar card: month nav + week strip */}
      <div className='w-full rounded-[12px] border border-[#CE8936] px-3 py-4 lg:px-5 lg:py-5'>
        <div className='flex flex-col gap-[15px]'>
          <div className='flex items-center justify-between'>
            <button
              type='button'
              aria-label='Previous week'
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              disabled={addDays(weekStart, -7) < today}
              className='grid size-[15px] place-items-center text-black disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'
            >
              <ChevronLeft className='size-[15px]' strokeWidth={2} />
            </button>
            <p className='text-xs font-medium leading-5 text-black'>
              {monthLabel}
            </p>
            <button
              type='button'
              aria-label='Next week'
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className='grid size-[15px] place-items-center text-black cursor-pointer'
            >
              <ChevronRight className='size-[15px]' strokeWidth={2} />
            </button>
          </div>

          <div className='flex items-center justify-between gap-[4.486px] lg:gap-2'>
            {week.map((d) => {
              const active = isSameDay(d, selectedDate)
              const disabled = !isBookable(d)
              return (
                <button
                  type='button'
                  key={formatYMD(d)}
                  onClick={() => !disabled && setSelectedDate(d)}
                  disabled={disabled}
                  className={[
                    'flex flex-1 min-w-0 flex-col items-center gap-[4.486px] overflow-hidden rounded-[4.486px] px-1 py-[9px] lg:px-[10px] lg:py-3 uppercase transition cursor-pointer',
                    active
                      ? 'bg-[#CE8936] text-white border border-transparent'
                      : 'border-[0.561px] border-[#E6E6E6] text-[#3A3D42]',
                    disabled &&
                      'opacity-40 cursor-not-allowed hover:border-[#E6E6E6]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className='text-[8px] leading-[7.851px]'>
                    {WEEKDAYS[d.getDay()]}
                  </span>
                  <span className='text-[14px] font-bold leading-[11.776px]'>
                    {d.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showTurnaround && (<>
      <p className='text-xs font-medium text-center text-black max-w-[230px] leading-5'>
        Free next day delivery available on all appointments completed before
        1pm
      </p>

      {/* Legend: what the 24h / 48h labels on each slot mean */}
      <div className='flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]'>
        <span className='inline-flex items-center gap-1.5'>
          <span className='rounded-full bg-[#E7F4EC] px-2 py-0.5 font-semibold text-[#1F7A45]'>
            24h
          </span>
          <span className='text-[#3A3D42]'>Next-day delivery</span>
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <span className='rounded-full bg-[#FBEEDD] px-2 py-0.5 font-semibold text-[#B5751B]'>
            48h
          </span>
          <span className='text-[#3A3D42]'>2-day delivery</span>
        </span>
      </div>
      </>)}

      {/* Time-window grid */}
      <div className='w-full'>
        {!selectedIsBookable ? (
          <p className='text-center text-xs text-[#6B7280]'>
            No availability on this date. Try another day.
          </p>
        ) : loadingSlots ? (
          <p className='text-center text-xs text-[#6B7280]'>
            Loading time slots…
          </p>
        ) : visibleSlots.length === 0 ? (
          <p className='text-center text-xs text-[#6B7280] py-4'>
            No available time slots for this date. Please pick another day.
          </p>
        ) : (
          <div className='grid grid-cols-3 gap-[6px]'>
            {visibleSlots.map((s) => {
              const active =
                value &&
                value.time === s.startTime &&
                value.date === formatYMD(selectedDate)
              const state = active ? 'white' : 'orange'
              const turn = turnHours(s.startTime)
              return (
                <button
                  type='button'
                  key={s.id}
                  onClick={() => pickSlot(s)}
                  className={[
                    'flex flex-col items-center justify-end gap-1 rounded-[8px] px-3 py-1.5 transition cursor-pointer',
                    active ? 'bg-[#D6866B]' : 'border border-[#CE8936]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {showTurnaround && (<span
                    className={[
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none',
                      active
                        ? 'bg-white/25 text-white'
                        : turn === '24'
                          ? 'bg-[#E7F4EC] text-[#1F7A45]'
                          : 'bg-[#FBEEDD] text-[#B5751B]',
                    ].join(' ')}
                  >
                    <Image
                      src={badgeSrc(s.startTime, state)}
                      alt={`${turn} hour delivery`}
                      width={40}
                      height={30}
                      className='h-auto w-5 shrink-0 object-contain'
                    />
                    {turn}h
                  </span>)}
                  <span
                    className={[
                      'text-xs text-center tracking-[-0.2px] whitespace-nowrap',
                      active ? 'text-white' : 'text-[#0D060C]',
                    ].join(' ')}
                  >
                    {fmt(s.startTime)} - {fmt(s.endTime)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
