"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveFutureApptAction } from "@/actions/futureAppt.action";
import { londonParts } from "@/lib/smsCore";
import { PRESET_DAYS, TIME_WINDOWS, addDays, dayOf, daysBetween, futureApptState } from "@/lib/futureAppt";

function longDate(day) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "15 Apr 2027, Thursday"
function dateWithDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  return `${longDate(day)}, ${d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}`;
}

// Calendar works in local Date objects; the app keeps "YYYY-MM-DD".
const toLocalDate = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fromLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MAX_DAYS = 730;

// Custom: days from today and the date, kept in step both ways.
function CustomDayPicker({ today, day, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [daysText, setDaysText] = React.useState(String(daysBetween(today, day)));
  React.useEffect(() => {
    setDaysText(String(daysBetween(today, day)));
  }, [day, today]);

  return (
    <div className='grid grid-cols-2 gap-2'>
      <div className='space-y-1'>
        <Label htmlFor='fa-days' className='text-xs text-muted-foreground'>
          Days from today
        </Label>
        <Input
          id='fa-days'
          type='number'
          inputMode='numeric'
          min={1}
          max={MAX_DAYS}
          value={daysText}
          onChange={(e) => {
            setDaysText(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= MAX_DAYS) onChange(addDays(today, n));
          }}
          onBlur={() => setDaysText(String(daysBetween(today, day)))}
        />
      </div>
      <div className='space-y-1'>
        <Label className='text-xs text-muted-foreground'>Date</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type='button' variant='outline' className='w-full justify-between font-normal'>
              {longDate(day)}
              <CalendarDays className='size-4 text-[#CE8936]' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto overflow-hidden p-0' align='end'>
            <Calendar
              mode='single'
              selected={toLocalDate(day)}
              defaultMonth={toLocalDate(day)}
              captionLayout='dropdown'
              startMonth={toLocalDate(today)}
              endMonth={toLocalDate(addDays(today, MAX_DAYS))}
              disabled={{ before: toLocalDate(addDays(today, 1)), after: toLocalDate(addDays(today, MAX_DAYS)) }}
              onSelect={(d) => {
                if (!d) return;
                onChange(fromLocalDate(d));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function DaysBadge({ days }) {
  if (!days) return null;
  return (
    <span className='inline-flex items-center rounded-md bg-[#E8F0FB] px-1.5 py-0.5 text-[11px] font-semibold text-[#2B5DA8]'>
      {days}d
    </span>
  );
}

function FutureApptDialog({ order, open, onOpenChange }) {
  const today = londonParts(new Date()).date;
  const savedDay = dayOf(order.futureApptAt);
  const [mode, setMode] = React.useState(() =>
    order.futureApptDays && PRESET_DAYS.includes(order.futureApptDays) ? String(order.futureApptDays) : savedDay ? "custom" : "84",
  );
  const [customDay, setCustomDay] = React.useState(savedDay && savedDay > today ? savedDay : addDays(today, 1));
  const [time, setTime] = React.useState(order.futureApptTime || "");
  const day = mode === "custom" ? customDay : addDays(today, Number(mode));

  const [state, action, saving] = React.useActionState(saveFutureApptAction, { success: null, msg: "" });
  React.useEffect(() => {
    if (state?.success === true) {
      toast.success(state.msg);
      onOpenChange(false);
    } else if (state?.success === false) toast.error(state.msg);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{savedDay ? "Edit future appointment" : "Add future appointment"}</DialogTitle>
          <DialogDescription>
            {order.medicineName}. The patient gets the review reminders by SMS when those automations are on.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className='space-y-4'>
          <input type='hidden' name='orderId' value={order.id} />
          <input type='hidden' name='day' value={day} />
          <input type='hidden' name='time' value={time} />
          <div className='space-y-2'>
            <Label>When</Label>
            <div className='grid grid-cols-3 gap-2'>
              {[...PRESET_DAYS.map(String), "custom"].map((m) => (
                <Button
                  key={m}
                  type='button'
                  variant={mode === m ? "default" : "outline"}
                  onClick={() => setMode(m)}
                >
                  {m === "custom" ? "Custom" : `${m} days`}
                </Button>
              ))}
            </div>
            {mode === "custom" ? <CustomDayPicker today={today} day={customDay} onChange={setCustomDay} /> : null}
            <p className='text-sm text-muted-foreground'>{day ? dateWithDay(day) : "Pick a date"}</p>
          </div>
          <div className='space-y-2'>
            <Label>Time</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Pick a time' />
              </SelectTrigger>
              <SelectContent>
                {TIME_WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.from} to {w.to}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className='gap-2 sm:justify-between'>
            {savedDay ? (
              <Button type='submit' name='clear' value='1' variant='outline' disabled={saving}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <Button type='submit' disabled={saving || !day || !time}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// "Future Appt" column of the patient's orders (CC-10).
export function FutureApptCell({ order }) {
  const [open, setOpen] = React.useState(false);
  const today = londonParts(new Date()).date;
  const state = futureApptState(order, today);
  const day = dayOf(order.futureApptAt);

  if (state === "past")
    return (
      <span className='flex items-center gap-2 text-muted-foreground' title='This appointment date has passed'>
        <DaysBadge days={order.futureApptDays} />
        {longDate(day)}
      </span>
    );

  return (
    <>
      {state === "add" ? (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-7 border-[#2B5DA8] text-[#2B5DA8] hover:bg-[#E8F0FB] hover:text-[#2B5DA8]'
          onClick={() => setOpen(true)}
        >
          <Plus /> Future Appt
        </Button>
      ) : (
        <button
          type='button'
          className='flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted'
          title='Edit future appointment'
          onClick={() => setOpen(true)}
        >
          <DaysBadge days={order.futureApptDays} />
          {longDate(day)}
        </button>
      )}
      {open ? <FutureApptDialog order={order} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
