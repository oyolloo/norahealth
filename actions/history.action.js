"use server";

import { revalidatePath } from "next/cache";
import { loggedInUserAction } from "./user.action";
import { prisma } from "@/lib/client/prisma";
import { getAdminUser } from "./admin.action";

export const createHistoryAction = async (prevState, formData) => {
  const history = formData.get("history");
  const userId = formData.get("userId");

  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const res = await prisma.history.create({
    data: {
      history,
      userId: Number(userId),
    },
  });

  revalidatePath("/profile/medical-history");

  if (res) {
    return {
      success: true,
      msg: "History Created",
    };
  }
};

// get all history
export const getAllHistoryAction = async () => {
  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const userId = payload?.payload?.id;

  const history = await prisma.history.findMany({
    where: {
      userId: Number(userId),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    history,
  };
};

// delete history
export const deleteHistory = async (formData) => {
  const historyId = formData.get("historyId");
  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const userId = payload?.payload?.id;

  await prisma.history.delete({
    where: {
      id: Number(historyId),
      userId: Number(userId),
    },
  });

  revalidatePath("/profile/medical-history");
};

// get history by user id
export const getHistoryByUserId = async (userId) => {
  const adminuser = await getAdminUser();

  const isAdmin = adminuser?.admin?.isAdmin || false;

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

  const history = await prisma.history.findMany({
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
    history,
  };
};

// create history by admin
export const createHistoryByAdminAction = async (prevState, formData) => {
  const history = formData.get("history");
  const userId = formData.get("userId");

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  const res = await prisma.history.create({
    data: {
      history,
      userId: Number(userId),
    },
  });

  revalidatePath(`/admin/${userId}/account`);

  if (res) {
    return {
      success: true,
      msg: "History Created",
    };
  }
};

// delete history by admin
export const deleteHistoryByAdmin = async (formData) => {
  const historyId = formData.get("historyId");
  const userId = formData.get("userId");

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  await prisma.history.delete({
    where: {
      id: Number(historyId),
      userId: Number(userId),
    },
  });

  revalidatePath(`/admin/${userId}/account`);
};
