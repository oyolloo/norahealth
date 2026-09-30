"use client";

import * as React from "react";
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
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  BadgeCheckIcon,
  ChevronDown,
  Edit,
  MoreHorizontal,
  PanelLeft,
  Trash,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { CreateUserForm } from "./create-user-form";
import { useAdmin } from "@/lib/adminContext";
import { deleteUserAction, updateUserRoleAction } from "@/actions/admin.action";
import { toast } from "sonner";
import { UpdateUserDialog } from "./update-user-dialog";
const formatRole = (role) =>
  role.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function UserTable({ users, admin }) {
  const { setMenuOpen } = useAdmin();
  const actor = admin?.admin; // logged in admin user
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [rowSelection, setRowSelection] = React.useState({});

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const canDeleteUser = (actor, targetUser) => {
    if (!actor || !targetUser) return false;

    const isSelf = actor?.id?.toString() === targetUser?.id?.toString();
    if (isSelf) return false;

    if (actor.role === "SUPERADMIN") return true;

    if (actor.role === "ADMIN") {
      return ["PATIENT", "AUTHOR"].includes(targetUser.role);
    }

    return false;
  };

  const openDeleteDialog = (user) => {
    setDeleteTarget(user);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const allowed = canDeleteUser(actor, deleteTarget);
    if (!allowed) {
      toast.error("Permission denied");
      return;
    }

    setIsDeleting(true);
    const res = await deleteUserAction(deleteTarget.id);

    if (!res.success) {
      toast.error(res.message);
      setIsDeleting(false);
      return;
    }

    toast.success(res.message);
    setIsDeleting(false);
    setDeleteOpen(false);
    setDeleteTarget(null);
    router.refresh();
  };
  const handleRoleChange = async (userId, newRole) => {
    const res = await updateUserRoleAction({ userId, newRole });

    if (!res.success) {
      toast.error(res.message);
      return;
    }

    toast.success(res.message);
  };
  const handleDeleteUser = async (userId) => {
    const ok = window.confirm("Are you sure you want to delete this user?");
    if (!ok) return;

    const res = await deleteUserAction(userId);

    if (!res.success) {
      toast.error(res.message);
      return;
    }

    toast.success(res.message);
  };

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
      accessorKey: "email",
      header: "Email",
      filterFn: (row, id, value) => {
        const v = (value ?? "").toString().toLowerCase();
        const cell = (row.getValue(id) ?? "").toString().toLowerCase();
        return cell.includes(v);
      },
      cell: ({ row }) => (
        <div>
          <Link
            href={`/admin/${row.getValue("id")}/orders`}
            className='hover:underline'
          >
            {row.getValue("email")}
          </Link>
        </div>
      ),
    },

    // {
    //   accessorKey: "role",
    //   header: "Role",
    //   cell: ({ row, table }) => {
    //     const role = row.getValue("role");
    //     const userId = row.getValue("id");
    //     const id = row.getValue("id").toString();
    //     const currentUserId = table?.options?.admin?.admin?.id.toString();

    //     const actor = table?.options?.admin?.admin;
    //     const actorRole = actor?.role;
    //     const actorId = actor?.id;

    //     const isSelf = actorId === userId;

    //     // Permission rules
    //     const canEdit =
    //       !isSelf &&
    //       (actorRole === "SUPERADMIN" ||
    //         (actorRole === "ADMIN" && role !== "SUPERADMIN"));

    //     const allowedRoles = (() => {
    //       if (!canEdit) return [];

    //       // ADMIN → PATIENT ↔ AUTHOR
    //       if (actorRole === "ADMIN") {
    //         return ["PATIENT", "AUTHOR"].filter((r) => r !== role);
    //       }

    //       // SUPERADMIN → ANY except self
    //       if (actorRole === "SUPERADMIN") {
    //         return ["PATIENT", "AUTHOR", "ADMIN"].filter((r) => r !== role);
    //       }

    //       return [];
    //     })();

    //     return (
    //       <div className='flex items-center gap-3'>
    //         {/* Role Badge */}
    //         <Badge
    //           className={`${
    //             role === "ADMIN" || role === "SUPERADMIN"
    //               ? "bg-green-400 text-white dark:bg-blue-600"
    //               : ""
    //           }`}
    //           variant={`${
    //             role === "ADMIN" || role === "SUPERADMIN"
    //               ? "secondary"
    //               : "outline"
    //           }`}
    //         >
    //           {id === currentUserId && <BadgeCheckIcon />}
    //           {formatRole(role)}
    //         </Badge>

    //         {/* Edit button */}
    //         {canEdit && allowedRoles.length > 0 && (
    //           <DropdownMenu>
    //             <DropdownMenuTrigger asChild>
    //               <Button
    //                 variant='ghost'
    //                 size='sm'
    //                 className='h-7 px-2 text-xs'
    //               >
    //                 <Edit />
    //               </Button>
    //             </DropdownMenuTrigger>

    //             <DropdownMenuContent align='end'>
    //               {allowedRoles.map((r) => (
    //                 <DropdownMenuItem
    //                   key={r}
    //                   onClick={async () => {
    //                     const res = await updateUserRoleAction({
    //                       userId,
    //                       newRole: r,
    //                     });

    //                     if (!res.success) {
    //                       toast.error(res.message);
    //                     } else {
    //                       toast.success(`Role updated to ${formatRole(r)}`);
    //                     }
    //                   }}
    //                 >
    //                   {formatRole(r)}
    //                 </DropdownMenuItem>
    //               ))}
    //             </DropdownMenuContent>
    //           </DropdownMenu>
    //         )}
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row, table }) => {
        const role = row.getValue("role");
        const userId = row.getValue("id").toString();
        const currentUserId = table?.options?.admin?.admin?.id?.toString();

        return (
          <Badge
            className={`${
              role === "ADMIN" || role === "SUPERADMIN"
                ? "bg-green-400 text-white dark:bg-blue-600"
                : ""
            }`}
            variant={
              role === "ADMIN" || role === "SUPERADMIN"
                ? "secondary"
                : "outline"
            }
          >
            {userId === currentUserId && (
              <BadgeCheckIcon className='mr-1 h-4 w-4' />
            )}
            {formatRole(role)}
          </Badge>
        );
      },
    },

    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => (
        <div className='capitalize'>
          {formatDate(row.getValue("createdAt"))}{" "}
        </div>
      ),
    },

    {
      id: "actions",
      enableHiding: false,
      cell: ({ row, table }) => {
        const user = row.original;
        const admin = table.options.admin.admin;
        const [open, setOpen] = React.useState(false);
        const canDelete = canDeleteUser(actor, user);

        return (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='h-8 w-8 p-0'>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setOpen(true)}>
                  Update User
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href={`/admin/${user.id}/records`}>Records</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/${user.id}/history`}>
                    Medical History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/${user.id}/orders`}>Orders</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={!canDelete}
                  className='text-red-600 focus:text-red-600'
                  onSelect={(e) => {
                    e.preventDefault();
                    openDeleteDialog(user);
                  }}
                >
                  <Trash className='mr-2 h-4 w-4' />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <UpdateUserDialog
              open={open}
              setOpen={setOpen}
              user={user}
              admin={admin}
            />
          </>
        );
      },
    },
  ];
  // Broad text search: match name, email, id, phone or role (not email-only).
  // Debounced: `searchInput` updates the box on every keystroke, but the actual
  // filter (`search`) only runs ~300ms after the user pauses. This keeps the
  // 1000+ row table DOM stable while typing, which also stops the page-level
  // Google Translate widget from re-processing the table on every keystroke.
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);
  const q = search.trim().toLowerCase();
  // Memoise the filtered list. Passing a brand-new array to the table's `data`
  // on every render makes TanStack's auto-reset (page index) fire each render,
  // which triggers a state update -> re-render -> new array -> reset again, i.e.
  // an infinite render loop (only when a query produced a fresh filtered array).
  // A stable reference that only changes when `users`/`q` change breaks it.
  const searchedUsers = React.useMemo(() => {
    if (!q) return users || [];
    return (users || []).filter((u) => {
      const acc = u?.account || {};
      return [
        u?.id,
        u?.email,
        u?.secondEmail,
        u?.role,
        acc.firstName,
        acc.lastName,
        [acc.firstName, acc.lastName].filter(Boolean).join(" "),
        acc.phoneNumber,
        u?.phoneNumber,
      ].some((f) => String(f ?? "").toLowerCase().includes(q));
    });
  }, [users, q]);

  const table = useReactTable({
    data: searchedUsers,
    admin: admin,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },

    initialState: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
  });

  return (
    <div className='w-full flex-1 min-w-0 overflow-x-hidden p-6 lg:p-10'>
      <div className='flex justify-between items-center'>
        {" "}
        {/* HEADER */}
        <div className='flex items-center gap-4 mb-4'>
          <button
            onClick={() => setMenuOpen(true)}
            className='lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full'
          >
            <PanelLeft />
          </button>
          <h2 className='text-xl font-semibold'>
            {" "}
            Patients{" "}
            <Badge variant='primary' className='bg-white'>
              {table?.options?.data.length}
            </Badge>
          </h2>
        </div>
      </div>
      <div className='flex flex-col gap-3 py-4 sm:flex-row sm:items-center'>
        {/* Mobile: Create (left) + Columns (right) on one row.
            Desktop: sm:contents flattens this so all three share one row. */}
        <div className='flex items-center justify-between gap-3 sm:contents'>
          <CreateUserForm />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' className='sm:order-last'>
                Columns <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className='capitalize'
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className='flex items-center w-full sm:flex-1'>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder='Search by name, email, phone or ID...'
            className='w-full sm:w-[260px] bg-white rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200'
          />
        </div>
      </div>
      <div className='w-full overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className='bg-white' key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className='bg-white'
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
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
                  className='h-24 text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-end space-x-2 py-4'>
        <div className='text-muted-foreground flex-1 text-sm'>
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className='space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
      <div>
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(v) => {
            setDeleteOpen(v);
            if (!v) {
              setDeleteTarget(null);
              setIsDeleting(false);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
                {deleteTarget?.email ? (
                  <span className='block mt-2'>
                    Deleting: <b>{deleteTarget.email}</b>
                  </span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>

              <AlertDialogAction
                className='bg-red-600 hover:bg-red-700'
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
