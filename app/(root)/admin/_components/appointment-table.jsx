"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

import { LoaderIcon, MoreHorizontal, PanelLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

import {
  createOrderFromBooking,
  deleteBooking,
  getAllBookingsAction,
  updateBookingStatus,
} from "@/actions/booking.action";
import { useAdmin } from "@/lib/adminContext";
import { toast } from "sonner";
import LoadingIcon from "@/components/global/loading";
import Link from "next/link";

const TableLoader = ({ colSpan }) => (
  <TableRow>
    <TableCell colSpan={colSpan} className='h-24 text-center'>
      <div className='flex items-center justify-center gap-2'>
        <div className='w-full justify-center items-center h-[30vh] flex'>
          <span>
            <LoaderIcon
              role='status'
              aria-label='Loading'
              className='size-5 animate-spin mx-auto'
            />
          </span>
        </div>
      </div>
    </TableCell>
  </TableRow>
);

// -----------------------
// TABLE COLUMNS
// -----------------------
const columns = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className='capitalize'>{row.getValue("id")}</div>,
  },
  {
    accessorKey: "fullName",
    header: "Full Name",
  },
  {
  accessorKey: "email",
  header: "Email",
  filterFn: (row, id, value) => {
    const v = (value ?? "").toString().toLowerCase();
    const cell = (row.getValue(id) ?? "").toString().toLowerCase();
    return cell.includes(v);
  },
  cell: ({ row }) => {
    const booking = row.original; // ✅ এখানে booking.user আছে
    const userId = booking?.user?.id;

    // userId না থাকলে (account নাই/ user নাই) শুধু email দেখাবে
    if (!userId) {
      return <div>{row.getValue("email")}</div>;
    }

    return (
      <div>
        <Link href={`/admin/${userId}/orders`} className="hover:underline">
          {row.getValue("email")}
        </Link>
      </div>
    );
  },
}
,
  {
    accessorKey: "phoneNumber",
    header: "Phone",
  },
  // {
  //   accessorKey: "serviceName",
  //   header: "Service",
  // },
  // {
  //   accessorKey: "providerName",
  //   header: "Provider",
  // },
  {
  accessorKey: "appointment",
  header: "Appointment",
  cell: ({ row }) => {
    const booking = row.original;

    const appt = booking?.appointment; // Date/string
    const slot = booking?.slot;        // { startTime, ... } (if you have it)

    if (!appt) return "—";

    return (
      <div>
        {formatDate(appt)} {slot?.startTime ? `at ${slot.startTime}` : ""}
      </div>
    );
  },
},

  // ✅ NEW: Booking Status column
  {
    accessorKey: "bookingStatus",
    header: "Status",
    filterFn: (row, id, value) => {
      if (!value) return true;
      return String(row.getValue(id)) === String(value);
    },
    cell: ({ row }) => {
      const s = row.getValue("bookingStatus") || "Incomplete";
      if (s === "Complete") {
        return <Badge className='bg-green-600 text-white'>Complete</Badge>;
      }
      if (s === "FailedEncounter") {
        return (
          <Badge className='bg-red-600 text-white'>Failed Encounter</Badge>
        );
      }
      if (s === "FirstCallAttempted") {
        return (
          <Badge className='bg-orange-500 text-white'>1st Call Attempted</Badge>
        );
      }
      if (s === "SecondCallAttempted") {
        return (
          <Badge className='bg-orange-500 text-white'>2nd Call Attempted</Badge>
        );
      }
      return <Badge className='bg-yellow-500 text-white'>Incomplete</Badge>;
    },
  },

  {
    id: "actions",
    header: "Actions",
    cell: ({ row, table }) => {
      const booking = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>

            {/* <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(String(booking.id))}
            >
              Copy ID
            </DropdownMenuItem> */}

            <DropdownMenuItem
              onClick={() => table.options.meta.onCreateOrder(booking)}
            >
              Create Order
            </DropdownMenuItem>

            {/* ✅ NEW: Update Booking Status */}
            <DropdownMenuItem
              onClick={() => table.options.meta.onUpdateBookingStatus(booking)}
            >
              Update Status
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Link href={`/admin/appointments-order/${booking.id}`}>
                View Details
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              className='text-red-600'
              onClick={() => table.options.meta.onDelete(booking.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// -----------------------
// MAIN COMPONENT
// -----------------------
export default function AppointmentOrderTable() {
  const { setMenuOpen } = useAdmin();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBookingId, setDeleteBookingId] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [medicineName, setMedicineName] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [status, setStatus] = useState("clinicalreview");
  const [columnFilters, setColumnFilters] = useState([]);

  const [creatingOrder, setCreatingOrder] = useState(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedBookingForStatus, setSelectedBookingForStatus] =
    useState(null);
  const [bookingStatus, setBookingStatus] = useState("Incomplete");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ✅ status filter (SelectItem value cannot be empty)
  const [bookingStatusFilter, setBookingStatusFilter] = useState("ALL");

  // Broad text search (name / email / phone / id), not email-only.
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!orderOpen) setCreatingOrder(false);
  }, [orderOpen]);

  // Fetch bookings
  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await getAllBookingsAction({
        year: year || undefined,
        month: month || undefined,
        day: day || undefined,
      });

      setBookings(res?.bookings || []);
    } catch (err) {
      console.error(err);
      setBookings([]);
    } finally {
      setLoading(false); // ✅ MUST be here
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchBookings();
  }, [year, month, day]);

  // Newest appointment first — latest date + time at the top (fully descending).
  // Rows without an appointment fall to the bottom.
  const sortedBookings = useMemo(
    () =>
      [...bookings].sort((a, b) => {
        const ta = a.appointment ? new Date(a.appointment).getTime() : -Infinity;
        const tb = b.appointment ? new Date(b.appointment).getTime() : -Infinity;
        return tb - ta;
      }),
    [bookings],
  );

  // Broad search: match the query against name, email, phone and id (not just
  // email) so the admin can find a patient by any of them.
  const searchedBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedBookings;
    return sortedBookings.filter((r) =>
      [r.fullName, r.email, r.phoneNumber, r.id].some((f) =>
        String(f ?? "").toLowerCase().includes(q)
      )
    );
  }, [sortedBookings, search]);

  // Table pagination + actions
  const table = useReactTable({
    data: searchedBookings,
    columns,
    state: {
      columnFilters,
    },

    onColumnFiltersChange: setColumnFilters,
    meta: {
      onDelete: async (id) => {
        setDeleteBookingId(id);
        setDeleteOpen(true);
        // const res = await deleteBooking({ bookingId: id });
        // if (res?.success) fetchBookings();
      },

      onCreateOrder: (booking) => {
        setSelectedBooking(booking);
        setMedicineName("");
        setTrackingId("");
        setStatus("clinicalreview");
        setOrderOpen(true);
      },

      onUpdateBookingStatus: (booking) => {
        setSelectedBookingForStatus(booking);
        setBookingStatus(booking.bookingStatus || "Incomplete");
        setStatusDialogOpen(true);
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Options
  const now = new Date();
  const currentYear = now.getFullYear();
  // first two preferred years (e.g. 2024, 2025)
  const preferredYears = [currentYear, currentYear + 1];
  const yearOptions = (() => {
    const s = new Set();
    preferredYears.forEach((y) => s.add(y));
    for (let y = 2024; y <= currentYear + 1; y++) s.add(y);
    return Array.from(s).sort((a, b) => a - b);
  })();

  const months = [
    { id: 1, label: "Jan" },
    { id: 2, label: "Feb" },
    { id: 3, label: "Mar" },
    { id: 4, label: "Apr" },
    { id: 5, label: "May" },
    { id: 6, label: "Jun" },
    { id: 7, label: "Jul" },
    { id: 8, label: "Aug" },
    { id: 9, label: "Sep" },
    { id: 10, label: "Oct" },
    { id: 11, label: "Nov" },
    { id: 12, label: "Dec" },
  ];

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  console.log("bookings", bookings);
  

  return (
    <div className='w-full p-6'>
      {/* HEADER */}
      <div className='flex items-center gap-4 mb-4'>
        <button
          onClick={() => setMenuOpen(true)}
          className='lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full'
        >
          <PanelLeft />
        </button>
        <h2 className='text-xl font-semibold'>Appointments</h2>
      </div>

      {/* FILTERS */}
      <div className='flex items-center gap-3 '>
        <div>
          <label className='block text-xs text-gray-600 mb-1'>Year</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className='w-[120px] bg-white/40'>
              <SelectValue placeholder='Year' />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className='block text-xs text-gray-600 mb-1'>Month</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className='w-[120px] bg-white/40'>
              <SelectValue placeholder='Month' />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className='block text-xs text-gray-600 mb-1'>Day</label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className='w-[80px] bg-white/40'>
              <SelectValue placeholder='Day' />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ✅ NEW: BookingStatus filter */}
        <div>
          <label className='block text-xs text-gray-600 mb-1'>Status</label>
          <Select
            value={bookingStatusFilter}
            onValueChange={(v) => {
              setBookingStatusFilter(v);
              table
                .getColumn("bookingStatus")
                ?.setFilterValue(v === "ALL" ? undefined : v);
            }}
          >
            <SelectTrigger className='w-[160px] bg-white/40'>
              <SelectValue placeholder='All' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>All</SelectItem>
              <SelectItem value='Incomplete'>Incomplete</SelectItem>
              <SelectItem value='FirstCallAttempted'>
                1st Call Attempted
              </SelectItem>
              <SelectItem value='SecondCallAttempted'>
                2nd Call Attempted
              </SelectItem>
              <SelectItem value='Complete'>Complete</SelectItem>
              <SelectItem value='FailedEncounter'>Failed Encounter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='ml-auto'>
          <Button
            variant='outline'
            onClick={() => {
              setYear("");
              setMonth("");
              setDay("");
              setBookingStatusFilter("ALL");
              table.getColumn("bookingStatus")?.setFilterValue(undefined);
              setSearch("");
            }}
          >
            Clear
          </Button>
        </div>
      </div>
      {/* SEARCH */}
      <div className='flex items-center py-4 w-full max-w-sm '>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search by name, email, phone or ID...'
          className='w-[260px] bg-white/40 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200'
        />
      </div>

      {/* TABLE */}
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableLoader colSpan={columns.length} />
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='text-center h-24'
                >
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION FOOTER */}
      <div className='flex items-center justify-end gap-2 py-4'>
        <Button
          variant='outline'
          size='sm'
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>

        <Button
          variant='outline'
          size='sm'
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
      </div>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Order</DialogTitle>
            <DialogDescription>
              Add these information to add Order
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div>
              <label className='text-sm font-medium'>Medicine Name</label>
              <Input
                placeholder='Insert Medicine Name'
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Tracking ID</label>
              <Input
                placeholder='EX: #XH45333A4825NR'
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Status</label>
              <Select
                value={status}
                onValueChange={setStatus}
                className='w-full'
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='clinicalreview'>
                    Awaiting Dispatch
                  </SelectItem>
                  <SelectItem value='posted'>Posted</SelectItem>
                  <SelectItem value='declined'>Declined</SelectItem>
                  {/* <SelectItem value='delivered'>Delivered</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOrderOpen(false)}>
              Cancel
            </Button>

            <Button
              className='bg-[#d18a2d] hover:bg-[#b97622]'
              disabled={creatingOrder}
              onClick={async () => {
                if (creatingOrder) return;

                // simple required validation (optional but useful)
                if (!medicineName?.trim())
                  return toast.error("Medicine Name is required");
                // if (!trackingId?.trim())
                //   return toast.error("Tracking ID is required");

                try {
                  setCreatingOrder(true);

                  const res = await createOrderFromBooking({
                    bookingId: selectedBooking.id,
                    medicineName: medicineName.trim(),
                    trackingId: trackingId.trim(),
                    status,
                  });

                  if (res?.success) {
                    toast.success(res?.message || "Order created successfully");
                    setOrderOpen(false);
                  } else {
                    toast.error(res?.message || "Failed");
                  }
                } finally {
                  setCreatingOrder(false);
                }
              }}
            >
              {creatingOrder ? (
                <span className='flex items-center gap-2'>
                  <LoaderIcon className='size-4 animate-spin' />
                  Creating...
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NEW: UPDATE BOOKING STATUS DIALOG */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Update Booking Status</DialogTitle>
            <DialogDescription>
              Mark this request as Incomplete, 1st/2nd Call Attempted,
              Complete, or Failed Encounter.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div>
              <label className='text-sm font-medium'>Status</label>
              <Select value={bookingStatus} onValueChange={setBookingStatus}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Incomplete'>Incomplete</SelectItem>
                  <SelectItem value='FirstCallAttempted'>
                    1st Call Attempted
                  </SelectItem>
                  <SelectItem value='SecondCallAttempted'>
                    2nd Call Attempted
                  </SelectItem>
                  <SelectItem value='Complete'>Complete</SelectItem>
                  <SelectItem value='FailedEncounter'>
                    Failed Encounter
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setStatusDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              className='bg-theme'
              disabled={updatingStatus}
              onClick={async () => {
                if (!selectedBookingForStatus?.id) return;

                try {
                  setUpdatingStatus(true);

                  const res = await updateBookingStatus({
                    bookingId: selectedBookingForStatus.id,
                    bookingStatus,
                  });

                  if (res?.success) {
                    toast.success(res?.msg || "Status updated");
                    setStatusDialogOpen(false);
                    await fetchBookings();
                  } else {
                    toast.error(res?.msg || "Update failed");
                  }
                } finally {
                  setUpdatingStatus(false);
                }
              }}
            >
              {updatingStatus ? (
                <span className='flex items-center gap-2'>
                  <LoaderIcon className='size-4 animate-spin' />
                  Updating...
                </span>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              booking and free the associated time slot.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700'
              onClick={async () => {
                const res = await deleteBooking({
                  bookingId: deleteBookingId,
                });

                if (res?.success) {
                  toast.success("Booking deleted");

                  // ✅ SHOW loader AFTER successful delete
                  setLoading(true);

                  // refetch bookings (this will hide loader when done)
                  await fetchBookings();
                } else {
                  toast.error(res?.msg || "Delete failed");
                }

                setDeleteOpen(false);
                setDeleteBookingId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

