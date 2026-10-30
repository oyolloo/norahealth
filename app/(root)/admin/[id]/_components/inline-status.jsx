"use client";

// Click-to-change status pills for a patient's Appointments and Orders,
// matching the inline selects on /admin/oc-orders (same actions, same rules).
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { updateBookingStatus } from "@/actions/booking.action";
import { updateOrderStatus } from "@/actions/order.action";

const TRIGGER =
  "h-auto w-fit gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0 focus-visible:ring-0 cursor-pointer [&>svg]:size-3.5 [&>svg]:opacity-50";

// Same pills the tables already show.
const BOOKING = {
  Incomplete: ["bg-yellow-500", "Incomplete"],
  FirstCallAttempted: ["bg-orange-500", "1st Call Attempted"],
  SecondCallAttempted: ["bg-orange-500", "2nd Call Attempted"],
  Complete: ["bg-green-600", "Complete"],
  FailedEncounter: ["bg-red-600", "Failed Encounter"],
};
const ORDER = {
  clinicalreview: ["bg-yellow-500", "Awaiting Dispatch"],
  posted: ["bg-green-500", "Posted via Royal Mail"],
  declined: ["bg-red-500", "Declined."],
};

const Pill = ({ map, value, fallback }) => {
  const [bg, label] = map[value] || map[fallback];
  return <Badge className={`${bg} text-white`}>{label}</Badge>;
};

export function BookingStatusInline({ booking }) {
  const router = useRouter();
  const [value, setValue] = React.useState(booking.bookingStatus || "Incomplete");
  React.useEffect(() => setValue(booking.bookingStatus || "Incomplete"), [booking.bookingStatus]);

  async function change(v) {
    if (v === value) return;
    const prev = value;
    setValue(v);
    try {
      const res = await updateBookingStatus({ bookingId: booking.id, bookingStatus: v });
      if (!res?.success) throw new Error(res?.msg);
      toast.success("Saved");
      router.refresh();
    } catch (e) {
      setValue(prev);
      toast.error(e?.message || "Update failed");
    }
  }

  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger aria-label="Change appointment status" className={TRIGGER}>
        <Pill map={BOOKING} value={value} fallback="Incomplete" />
      </SelectTrigger>
      <SelectContent>
        {Object.keys(BOOKING).map((k) => (
          <SelectItem key={k} value={k}>
            <Pill map={BOOKING} value={k} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OrderStatusInline({ order }) {
  const router = useRouter();
  const [value, setValue] = React.useState(order.status || "clinicalreview");
  const [askTracking, setAskTracking] = React.useState(false);
  const [trackingId, setTrackingId] = React.useState(order.trackingId || "");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setValue(order.status || "clinicalreview"), [order.status]);

  async function save(v, tracking) {
    const prev = value;
    setValue(v);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("orderId", String(order.id));
      fd.set("trackingId", tracking ?? order.trackingId ?? "");
      fd.set("status", v);
      const res = await updateOrderStatus(null, fd);
      if (!res?.success) throw new Error(res?.msg);
      toast.success("Saved");
      setAskTracking(false);
      router.refresh();
    } catch (e) {
      setValue(prev);
      toast.error(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === value) return;
          // Posted asks for the tracking ID first, as on OC Orders.
          if (v === "posted") {
            setTrackingId(order.trackingId || "");
            setAskTracking(true);
            return;
          }
          save(v);
        }}
      >
        <SelectTrigger aria-label="Change order status" className={TRIGGER}>
          <Pill map={ORDER} value={value} fallback="clinicalreview" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(ORDER).map((k) => (
            <SelectItem key={k} value={k}>
              <Pill map={ORDER} value={k} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={askTracking} onOpenChange={setAskTracking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Posted via Royal Mail</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save("posted", trackingId.trim());
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`trk-${order.id}`}>Tracking ID</Label>
              <Input
                id={`trk-${order.id}`}
                value={trackingId}
                placeholder="Enter tracking id"
                onChange={(e) => setTrackingId(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAskTracking(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
