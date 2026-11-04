import React from "react";

import { loggedInUserDetailsAction } from "@/actions/user.action";
import ConfirmOrder from "./_components/confirm-order";
import { redirect } from "next/navigation";

const page = async () => {
  const result = await loggedInUserDetailsAction();
  const userDetails = result?.userDetails ?? null;

  // 🚫 Not logged in → redirect to login with callback
  if (!userDetails) {
    redirect("/login?callbackUrl=/booking/order");
  }

  return (
    <>
      <ConfirmOrder userDetails={userDetails} />
    </>
  );
};

export default page;
