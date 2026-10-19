"use server";

import { prisma } from "@/lib/client/prisma";
import { loggedInUserAction } from "./user.action";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin.action";

// create record
export const createRecordAction = async (prevState, formData) => {
  const userId = Number(formData.get("userId"));
  const weight = formData.get("weight");
  const height = formData.get("height");
  const lwhcheck = new Date(formData.get("lwhcheck"));
  const bp = formData.get("bp");
  const lbpcheck = new Date(formData.get("lbpcheck"));

  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  if (!weight || !height || !lwhcheck || !bp || !lbpcheck) {
    return {
      msg: "Please insert all the fields",
      success: false,
    };
  }

  const record = await prisma.record.create({
    data: {
      userId,
      weight,
      height,
      lastwhCheck: lwhcheck,
      bloodPressure: bp,
      lastBpCheckDate: lbpcheck,
    },
  });

  revalidatePath("/profile/health-records");

  if (record) {
    return {
      msg: "Record Created",
      success: true,
    };
  }
};

// get all the record
export const getAllRecordsAction = async () => {
  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const userId = payload?.payload?.id;

  const records = await prisma.record.findMany({
    where: {
      userId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    records,
  };
};

// delete record
export const deleteRecord = async (formData) => {
  const recordId = formData.get("recordId");

  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const userId = payload?.payload?.id;

  await prisma.record.delete({
    where: {
      id: Number(recordId),
      userId: Number(userId),
    },
  });

  revalidatePath("/profile/health-records");
};

// get record by user id
export const getRecordByUserId = async (userId) => {
  const adminuser = await getAdminUser();

  const isAdmin = adminuser?.admin?.isAdmin || false;
  // console.log(isAdmin, "isAdmin");

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      email: true,
      account: true,
      // add only what you need
    },
  });

  if (!user) {
    return {
      success: false,
      message: "User not found",
    };
  }

  const records = await prisma.record.findMany({
    where: {
      userId: Number(userId),
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    success: true,
    user,
    records,
  };
};

// create record by admin
export const createRecordByAdmin = async (prevState, formData) => {
  const userId = Number(formData.get("userId"));
  const weight = formData.get("weight");
  const height = formData.get("height");
  const lwhcheck = new Date(formData.get("lwhcheck"));
  const bp = formData.get("bp");
  const lbpcheck = new Date(formData.get("lbpcheck"));

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  if (!weight || !height || !lwhcheck || !bp || !lbpcheck) {
    return {
      msg: "Please insert all the fields",
      success: false,
    };
  }

  const record = await prisma.record.create({
    data: {
      userId,
      weight,
      height,
      lastwhCheck: lwhcheck,
      bloodPressure: bp,
      lastBpCheckDate: lbpcheck,
    },
  });

  revalidatePath(`/admin/${userId}/account`);

  if (record) {
    return {
      msg: "Record Created",
      success: true,
    };
  }
};

// delete record by admin
export const deleteRecordByAdmin = async (formData) => {
  const recordId = formData.get("recordId");
  const userId = formData.get("userId");

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  const res = await prisma.record.delete({
    where: {
      id: Number(recordId),
      userId: Number(userId),
    },
  });

  revalidatePath(`/admin/${userId}/account`);
};
