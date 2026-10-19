"use server";

import { prisma } from "@/lib/client/prisma";
import { loggedInUserAction } from "./user.action";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin.action";

// create medication action
export const createMedicationAction = async (prevState, formData) => {
  const medication = formData.get("medication");

  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const res = await prisma.medication.create({
    data: {
      label: medication,
      userId: Number(payload?.payload?.id),
    },
  });

  revalidatePath("/profile/medications");

  if (res) {
    return {
      msg: "Medication Created",
      success: true,
    };
  }
};

// get all medications action
export const getAllMedicationsAction = async () => {
  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const res = await prisma.medication.findMany({
    where: {
      userId: Number(payload?.payload?.id),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    success: true,
    medications: res,
  };
};

// delete medication action
export const deleteMedicationAction = async (formData) => {
  const medicationId = formData.get("medicationId");

  const payload = await loggedInUserAction();

  if (!payload?.payload?.id) {
    return {
      msg: "User not logged In",
      success: false,
    };
  }

  const res = await prisma.medication.delete({
    where: {
      id: Number(medicationId),
      userId: Number(payload?.payload?.id),
    },
  });

  revalidatePath("/profile/medications");

  if (res) {
    return {
      msg: "Medication Deleted",
      success: true,
    };
  }
};

// get medication by user id
export const getMedicationByUserId = async (userId) => {
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

  const medication = await prisma.medication.findMany({
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
    medication,
  };
};

// create Medication by admin
export const createMedicationByAdminAction = async (prevState, formData) => {
  const medication = formData.get("medication");
  const userId = formData.get("userId");

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  const res = await prisma.medication.create({
    data: {
      label: medication,
      userId: Number(userId),
    },
  });

  revalidatePath(`/admin/${userId}/account`);

  if (res) {
    return {
      msg: "Medication Created",
      success: true,
    };
  }
};

// delete medication action by admin
export const deleteMedicationByAdmin = async (formData) => {
  const medicationId = formData.get("medicationId");
  const userId = formData.get("userId");

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  const res = await prisma.medication.delete({
    where: {
      id: Number(medicationId),
      userId: Number(userId),
    },
  });

  revalidatePath(`/admin/${userId}/account`);

  if (res) {
    return {
      msg: "Medication Deleted",
      success: true,
    };
  }
};
