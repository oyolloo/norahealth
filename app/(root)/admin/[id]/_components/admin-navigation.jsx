"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const AdminNavigation = ({ userId }) => {
  const path = usePathname();
  console.log("PATH:", path);
  return (
    <>
      <div className='flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide'>
        <ButtonGroup>
          <ButtonGroup className='hidden sm:flex'>
            <Button variant='outline' size='icon' aria-label='Go Back' asChild>
              <Link href='/admin'>
                <ArrowLeftIcon />
              </Link>
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            {/* Scrollable buttons */}
            <Button
              variant={
                path.toString() === `/admin/${userId}/account`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/account`}>Account Info</Link>
            </Button>
            <Button
              variant={
                path.toString() === `/admin/${userId}/records`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/records`}>Medical Records</Link>
            </Button>
            <Button
              variant={
                path.toString() === `/admin/${userId}/history`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/history`}>Medical History</Link>
            </Button>
            <Button
              variant={
                path.toString() === `/admin/${userId}/medications`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/medications`}>Medications</Link>
            </Button>
            <Button
              variant={
                path.toString() === `/admin/${userId}/orders`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/orders`}>Orders</Link>
            </Button>
            <Button
              variant={
                path.toString() === `/admin/${userId}/appointments`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/appointments`}>Appointments</Link>
            </Button>
          </ButtonGroup>
        </ButtonGroup>
      </div>
    </>
  );
};

export default AdminNavigation;
