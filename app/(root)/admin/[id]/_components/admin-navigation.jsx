"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const AdminNavigation = ({ userId }) => {
  const path = usePathname();
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
            {/* Records, history, medications and appointments live on the Account Info page */}
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
                path.toString() === `/admin/${userId}/orders`
                  ? "default"
                  : "outline"
              }
              asChild
            >
              <Link href={`/admin/${userId}/orders`}>Orders</Link>
            </Button>
          </ButtonGroup>
        </ButtonGroup>
      </div>
    </>
  );
};

export default AdminNavigation;
