"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAppointmentByAdmin } from "@/actions/booking.action";
import { getBookingSlots } from "@/actions/bookingSlot.action";
import { useState, useEffect, useActionState, useMemo } from "react";
import { LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { getFullName } from "@/lib/utils";

function formatSlotRange(startTime, endTime) {
  if (endTime) return `${startTime} - ${endTime}`;
  const [h, m] = startTime.split(":").map(Number);
  const nextH = String((h + 1) % 24).padStart(2, "0");
  const nextM = String(m).padStart(2, "0");
  return `${startTime} - ${nextH}:${nextM}`;
}

function getDefaultDate() {
  const d = new Date();
  if (d.getDay() === 0) {
    // If today is Sunday, default to tomorrow (Monday)
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreateAppointmentForm({ userId, user }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(getDefaultDate);
  const [time, setTime] = useState("09:00");
  const [ocRequest, setOcRequest] = useState("SAME_OC");
  const [status, setStatus] = useState("Incomplete");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const initialState = {
    msg: "",
    success: false,
  };

  const [state, action, loading] = useActionState(
    createAppointmentByAdmin,
    initialState
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.msg || "Appointment created successfully");
      setOpen(false);
    } else if (state?.msg) {
      toast.error(state.msg);
    }
  }, [state]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const dateObj = useMemo(() => {
    if (!date) return null;
    return new Date(`${date}T00:00:00`);
  }, [date]);

  const dayOfWeek = dateObj ? dateObj.getDay() : null; // 0=Sun, 6=Sat
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;

  // Fetch slots whenever the selected date changes
  useEffect(() => {
    if (!date || isSunday) {
      setSlots([]);
      return;
    }

    let isMounted = true;
    setLoadingSlots(true);

    getBookingSlots(date)
      .then((res) => {
        if (!isMounted) return;
        const fetchedSlots = res?.data || [];

        let slotList = [];
        if (fetchedSlots.length > 0) {
          slotList = fetchedSlots.map((s) => ({
            time: s.startTime,
            isFull: Boolean(s.isFull),
            label: formatSlotRange(s.startTime, s.endTime),
          }));
        } else {
          // If no pre-configured slots exist for this day in DB, fallback to opening hours
          const baseHours = isSaturday
            ? ["09:00", "10:00"]
            : [
                "08:00",
                "09:00",
                "10:00",
                "11:00",
                "12:00",
                "13:00",
                "14:00",
                "15:00",
                "16:00",
                "17:00",
                "18:00",
              ];
          slotList = baseHours.map((t) => ({
            time: t,
            isFull: false,
            label: formatSlotRange(t),
          }));
        }

        // Restrict Saturday slots strictly to 09:00 - 11:00
        if (isSaturday) {
          slotList = slotList.filter(
            (s) => s.time >= "09:00" && s.time < "11:00"
          );
        }

        setSlots(slotList);

        // Auto-select the first available slot if current time is full or missing
        const currentSlotValid = slotList.find((s) => s.time === time && !s.isFull);
        if (!currentSlotValid) {
          const firstAvailable = slotList.find((s) => !s.isFull);
          if (firstAvailable) {
            setTime(firstAvailable.time);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching booking slots:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [date, isSunday, isSaturday]);

  const selectedSlotInfo = slots.find((s) => s.time === time);
  const isCurrentSlotFull = Boolean(selectedSlotInfo?.isFull);

  const patientName = user ? getFullName(user) : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          Create Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Create Appointment</DialogTitle>
            <DialogDescription>
              Schedule a telephone appointment for {patientName || "patient"}.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />
          <input type="hidden" name="ocRequest" value={ocRequest} />
          <input type="hidden" name="status" value={status} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="dateInput">Appointment Date</Label>
              <Input
                id="dateInput"
                type="date"
                min={todayStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              {isSunday && (
                <p className="text-xs font-medium text-destructive">
                  ⚠️ The clinic is closed on Sundays. Please select a working day (Mon–Sat).
                </p>
              )}
              {isSaturday && (
                <p className="text-xs text-amber-600">
                  ℹ️ Saturday clinic hours are 09:00 – 11:00 only.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="time">Appointment Time</Label>
                {loadingSlots && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <LoaderIcon className="size-3 animate-spin" /> Checking slots...
                  </span>
                )}
              </div>
              <Select
                value={time}
                onValueChange={setTime}
                disabled={isSunday || loadingSlots || slots.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      isSunday
                        ? "Clinic closed on Sundays"
                        : loadingSlots
                        ? "Loading slots..."
                        : "Select Time"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((slot) => (
                    <SelectItem
                      key={slot.time}
                      value={slot.time}
                      disabled={slot.isFull}
                      className={
                        slot.isFull
                          ? "opacity-40 cursor-not-allowed pointer-events-none"
                          : "cursor-pointer"
                      }
                    >
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCurrentSlotFull && (
                <p className="text-xs font-medium text-destructive">
                  ⚠️ This time slot is already fully booked. Please choose an available slot.
                </p>
              )}
              {!isSunday && !loadingSlots && slots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No slots found for this date.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ocRequest">OC Request</Label>
              <Select value={ocRequest} onValueChange={setOcRequest}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select OC Request" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAME_OC">Same OC (Current pill)</SelectItem>
                  <SelectItem value="DIFFERENT_OC">
                    Different OC (New pill)
                  </SelectItem>
                  <SelectItem value="MORNING_AFTER_PILL">
                    Morning After Pill
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incomplete">Incomplete</SelectItem>
                  <SelectItem value="FirstCallAttempted">
                    1st Call Attempted
                  </SelectItem>
                  <SelectItem value="SecondCallAttempted">
                    2nd Call Attempted
                  </SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                  <SelectItem value="FailedEncounter">
                    Failed Encounter
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Add any appointment notes..."
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                isSunday ||
                isCurrentSlotFull ||
                !time ||
                loadingSlots
              }
            >
              {loading ? (
                <>
                  <LoaderIcon className="mr-2 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Save Appointment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
