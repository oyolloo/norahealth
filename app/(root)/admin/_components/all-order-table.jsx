"use client";

import React, { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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

import { MoreHorizontal, PanelLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAdmin } from "@/lib/adminContext";
import Link from "next/link";
import { toast } from "sonner";

import { deleteOrder, updateOrderStatus } from "@/actions/order.action";

const STICKY_RIGHT_TH =
  "sticky right-0 z-40 bg-[#faf9f8] border-l min-w-[110px] shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]";
const STICKY_RIGHT_TD =
  "sticky right-0 z-30 bg-[#faf9f8] border-l min-w-[110px] shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.10)]";

const statusPill = (status, trackingId) => {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap";

  if (status === "clinicalreview") {
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
        Awaiting Dispatch
      </span>
    );
  }

  if (status === "posted") {
    return (
      <span
        className={`${base} bg-blue-50 text-blue-700 border-blue-200 flex flex-col items-start`}
      >
        <span>Posted via Royal Mail</span>
        {trackingId ? <span>{`Tracking ID: ${trackingId}`}</span> : null}
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
        Delivered
      </span>
    );
  }
   if (status === "declined") {
    return (
      <span className={`${base} bg-red-50 text-red-500 border-red-200`}>
        Declined
      </span>
    );
  }

  return (
    <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>
      {String(status)}
    </span>
  );
};

export default function AllOrdersTable({
  initialOrders = [],
  initialTotal = 0,
  initialPageIndex = 0,
  pageSize = 10,
  initialFilters = {
    year: "all",
    month: "all",
    day: "all",
    status: "all",
    email: "",
  },
}) {
  const router = useRouter();
  const { setMenuOpen } = useAdmin();

  // These states only control the UI controls.
  const [year, setYear] = useState(initialFilters.year);
  const [month, setMonth] = useState(initialFilters.month);
  const [day, setDay] = useState(initialFilters.day);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [emailSearch, setEmailSearch] = useState(initialFilters.email);

  // Dialog
  const [open, setOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [status, setStatus] = useState("");

  const totalPages = Math.max(1, Math.ceil((initialTotal || 0) / pageSize));

  // Build URL from UI state
  const pushWithParams = (overrides = {}) => {
    const params = new URLSearchParams();

    const nextYear = overrides.year ?? year;
    const nextMonth = overrides.month ?? month;
    const nextDay = overrides.day ?? day;
    const nextStatus = overrides.status ?? statusFilter;
    const nextEmail = overrides.email ?? emailSearch;
    const nextPage = overrides.page ?? 0;

    if (nextYear && nextYear !== "all") params.set("year", nextYear);
    if (nextMonth && nextMonth !== "all") params.set("month", nextMonth);
    if (nextDay && nextDay !== "all") params.set("day", nextDay);
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextEmail && nextEmail.trim()) params.set("email", nextEmail.trim());
    if (nextPage && Number(nextPage) > 0) params.set("page", String(nextPage));

    router.push(`/admin/orders?${params.toString()}`);
  };

  // Table columns
  const columns = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
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
      },
      { accessorKey: "id", header: "ID" },
      { accessorKey: "fullName", header: "Full Name" },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <Link
            href={`/admin/${row.original.userId}/orders`}
            className='hover:underline'
          >
            {row.getValue("email")}
          </Link>
        ),
      },
      { accessorKey: "phoneNumber", header: "Phone" },
      { accessorKey: "medicineName", header: "Medicine" },
      { accessorKey: "trackingId", header: "Tracking ID" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          statusPill(row.getValue("status"), row.getValue("trackingId")),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDate(new Date(row.getValue("createdAt"))),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const order = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='h-8 w-8 p-0'>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>

                <DropdownMenuItem asChild>
                  <Link href={`/admin/orders/${order.id}`}>View Details</Link>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setSelectedOrder(order);
                    setStatus(order?.status || "");
                    setOpen(true);
                  }}
                >
                  Update Status
                </DropdownMenuItem>

                <DropdownMenuItem
                  className='text-red-600'
                  onClick={async () => {
                    const ok = confirm("Delete this order?");
                    if (!ok) return;

                    const res = await deleteOrder({ orderId: order.id });
                    if (res?.success) {
                      toast.success(res?.message || "Order deleted");
                      // Refresh current server data
                      router.refresh();
                    } else {
                      toast.error(res?.message || "Delete failed");
                    }
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [router],
  );

  const table = useReactTable({
    data: initialOrders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Year options (no future year)
  const START_YEAR = 2024;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear - START_YEAR + 1 },
    (_, i) => String(START_YEAR + i),
  );

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
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  const isPosted = status === "posted";
  const initial = { success: null, msg: "" };
  const [actionState, formAction, isPending] = React.useActionState(
    updateOrderStatus,
    initial,
  );

  React.useEffect(() => {
    if (actionState?.success === true) {
      toast.success(actionState.msg || "Updated");
      setOpen(false);
    }
    if (actionState?.success === false) {
      toast.error(actionState.msg || "Update failed");
    }
  }, [actionState]);

  return (
    <div className='w-full p-6 overflow-x-auto'>
      {/* HEADER */}
      <div className='flex items-center gap-4 mb-4'>
        <button
          onClick={() => setMenuOpen(true)}
          className='lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full'
        >
          <PanelLeft />
        </button>
        <h2 className='text-xl font-semibold'>Orders</h2>
      </div>

      {/* FILTERS (onChange updates URL immediately) */}
      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <label className='block text-xs text-gray-600 mb-1'>Year</label>
          <Select
            value={year}
            onValueChange={(v) => {
              setYear(v);
              pushWithParams({ year: v, page: 0 });
            }}
          >
            <SelectTrigger className='w-[120px] bg-white/40'>
              <SelectValue placeholder='Year' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className='block text-xs text-gray-600 mb-1'>Month</label>
          <Select
            value={month}
            onValueChange={(v) => {
              setMonth(v);
              pushWithParams({ month: v, page: 0 });
            }}
          >
            <SelectTrigger className='w-[120px] bg-white/40'>
              <SelectValue placeholder='Month' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
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
          <Select
            value={day}
            onValueChange={(v) => {
              setDay(v);
              pushWithParams({ day: v, page: 0 });
            }}
          >
            <SelectTrigger className='w-[80px] bg-white/40'>
              <SelectValue placeholder='Day' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
              {days.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className='block text-xs text-gray-600 mb-1'>Status</label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              pushWithParams({ status: v, page: 0 });
            }}
          >
            <SelectTrigger className='w-[180px] bg-white/40'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
              <SelectItem value='clinicalreview'>Awaiting Dispatch</SelectItem>
              <SelectItem value='posted'>Posted</SelectItem>
              <SelectItem value='declined'>Declined</SelectItem>
              {/* <SelectItem value='delivered'>Delivered</SelectItem> */}
            </SelectContent>
          </Select>
        </div>

        <div className='ml-auto'>
          <Button
            variant='outline'
            onClick={() => {
              setYear("all");
              setMonth("all");
              setDay("all");
              setStatusFilter("all");
              setEmailSearch("");
              router.push("/admin/orders"); // clears searchParams
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* SEARCH — email, patient name, medicine, tracking or order id */}
      <div className='flex items-center py-4 w-full max-w-sm gap-2'>
        <input
          value={emailSearch}
          onChange={(e) => setEmailSearch(e.target.value)}
          placeholder='Search by name, email, tracking or ID...'
          className='w-[260px] bg-white/40 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200'
        />
        <Button
          variant='outline'
          onClick={() => pushWithParams({ email: emailSearch, page: 0 })}
        >
          Search
        </Button>
      </div>

      {/* TABLE */}
      <div className='rounded-md border overflow-x-auto'>
        <Table className='min-w-max'>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.id === "actions" ? STICKY_RIGHT_TH : ""
                    }
                  >
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === "actions" ? STICKY_RIGHT_TD : ""
                      }
                    >
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
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION (URL-driven) */}
      <div className='flex items-center justify-end gap-3 py-4'>
        <Button
          variant='outline'
          size='sm'
          disabled={initialPageIndex === 0}
          onClick={() => pushWithParams({ page: initialPageIndex - 1 })}
        >
          Previous
        </Button>

        <div className='text-sm text-muted-foreground'>
          Page {initialPageIndex + 1} of {totalPages} ({initialTotal} total)
        </div>

        <Button
          variant='outline'
          size='sm'
          disabled={initialPageIndex + 1 >= totalPages}
          onClick={() => pushWithParams({ page: initialPageIndex + 1 })}
        >
          Next
        </Button>
      </div>

      {/* UPDATE STATUS DIALOG (kept as-is; refresh on submit) */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setSelectedOrder(null);
            setStatus("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>

          {/* <form
            action={updateOrderStatus}
            onSubmit={() => {
              setOpen(false);
              router.refresh(); // refresh server data
            }}
            className='space-y-4'
          >
            <input
              type='hidden'
              name='orderId'
              value={selectedOrder?.id || ""}
            />
            <input type='hidden' name='status' value={status} />

            <div>
              <label className='mb-2 block font-medium'>
                Tracking ID{" "}
                {isPosted ? <span className='text-red-500'>*</span> : null}
              </label>

              <Input
                type='text'
                name='trackingId'
                value={selectedOrder?.trackingId ?? ""}
                onChange={(e) =>
                  setSelectedOrder((prev) => ({
                    ...(prev || {}),
                    trackingId: e.target.value,
                  }))
                }
                required={isPosted}
                placeholder={
                  isPosted ? "Enter tracking id" : "Required only for Posted"
                }
              />
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Select status' />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value='clinicalreview'>
                  Awaiting Dispatch
                </SelectItem>
                <SelectItem value='posted'>Posted via Royal Mail</SelectItem>
              </SelectContent>
            </Select>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                className='bg-theme'
                disabled={isPosted && !(selectedOrder?.trackingId || "").trim()}
              >
                Update
              </Button>
            </DialogFooter>
          </form> */}
          <form action={formAction} className='space-y-4'>
            <input
              type='hidden'
              name='orderId'
              value={selectedOrder?.id || ""}
            />

            <div>
              <label className='mb-2 block font-medium'>Tracking ID</label>
              <Input
                type='text'
                name='trackingId'
                value={selectedOrder?.trackingId || ""}
                placeholder='Enter tracking id'
                onChange={(e) =>
                  setSelectedOrder({
                    ...selectedOrder,
                    trackingId: e.target.value,
                  })
                }
              />
            </div>

            <Select
              name='status'
              value={status}
              onValueChange={(val) => setStatus(val)}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Select status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='clinicalreview'>
                  Awaiting Dispatch
                </SelectItem>
                <SelectItem value='posted'>Posted via Royal Mail</SelectItem>
                <SelectItem value='declined'>Declined</SelectItem>
              </SelectContent>
            </Select>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>

              <Button type='submit' className='bg-theme' disabled={isPending}>
                {isPending ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
