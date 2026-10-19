"use server";

import { verifyToken } from "@/lib/jwt/jwt";
import { prisma } from "@/lib/client/prisma";
import { FULL_ADDRESS_MSG, isFullAddress } from "@/lib/addressLookup";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
const isAdminRole = (role) => role === "ADMIN" || role === "SUPERADMIN";

const isSuperAdmin = (role) => role === "SUPERADMIN";
const ROLE_PRIORITY = {
  SUPERADMIN: 1,
  ADMIN: 2,
  AUTHOR: 3,
  PATIENT: 4,
};

// get admin user action
export const getAdminUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = await verifyToken(token);

  if (payload && (payload.role === "ADMIN" || payload.role === "SUPERADMIN")) {
    return { success: true, admin: payload };
  }

  return null;
};

// get all users action
export const getAllUsersAction = async () => {
  const user = await getAdminUser();

  if (!user || !isAdminRole(user.admin.role)) {
    return { success: false, message: "Unauthorized" };
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // 🔥 Custom role-based ordering
  users.sort((a, b) => {
    // 1️⃣ Role priority
    const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];

    if (roleDiff !== 0) return roleDiff;

    // 2️⃣ createdAt DESC within same role
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { success: true, users };
};

// create an user action
export const createUserAction = async (prevState, formData) => {
  const rawEmail = formData.get("email");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = (formData.get("password") || "").toString();
  const isAdminUser = formData.get("isAdmin") === "true";

  if (!email || !password) {
    return { success: false, msg: "Email and password are required." };
  }

  // getAdminUser() already returns null for non-admins, so this is the only
  // auth check needed. (The old `user.admin.isAdmin` check wrongly blocked
  // admins whose token had isAdmin=false, and returned `message` instead of
  // `msg`, so the form showed nothing — it looked like "nothing happened".)
  const user = await getAdminUser();
  if (!user) {
    return { success: false, msg: "Unauthorized. Please sign in as an admin." };
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return {
        success: false,
        msg: "Looks like this email already has an account.",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        isAdmin: isAdminUser,
        role: isAdminUser ? "ADMIN" : "PATIENT",
      },
    });

    // Note: admin-created patients do not get the welcome email here — the
    // welcome email is personalised ("Hello <first name>,") and is sent when a
    // patient completes their own Account Registration, where the name exists.

    revalidatePath("/admin");
    return { success: true, msg: "User created successfully" };
  } catch (err) {
    console.error("createUserAction error:", err);
    return { success: false, msg: "Failed to create user. Please try again." };
  }
};

export const updateUserRoleAction = async ({ userId, newRole }) => {
  const actor = await getAdminUser();

  if (!actor) {
    return { success: false, message: "Unauthorized" };
  }

  const actorRole = actor.admin.role;
  const actorId = actor.admin.id;

  // ❌ No self role change
  if (actorId === userId) {
    return { success: false, message: "You cannot change your own role" };
  }

  // ❌ AUTHOR & PATIENT cannot change roles
  if (actorRole === "AUTHOR" || actorRole === "PATIENT") {
    return { success: false, message: "Permission denied" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  const targetRole = targetUser.role;

  // 🔒 ADMIN: ONLY PATIENT ↔ AUTHOR
  if (actorRole === "ADMIN") {
    const allowedRoles = ["PATIENT", "AUTHOR"];

    if (!allowedRoles.includes(targetRole) || !allowedRoles.includes(newRole)) {
      return {
        success: false,
        message: "Admin can only change Patient ↔ Author",
      };
    }
  }

  // 🔒 SUPERADMIN: ANY role except self (already checked)
  if (actorRole === "SUPERADMIN") {
    // Superadmin has full access
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  revalidatePath("/admin");

  return { success: true, message: "User role updated successfully" };
};

// Action to update account by admin
export const updateAccountByAdmin = async (prevState, formData) => {
  const userId = Number(formData.get("userId"));
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const dob = new Date(formData.get("dob"));
  const phoneNumber = formData.get("phoneNumber");
  const nhsNumber = formData.get("nhs");
  const address = formData.get("address");
  const zipCode = formData.get("zip");
  const deliveryAddress = formData.get("deliveryAddress");


  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  if (!firstName || !lastName || !dob || !phoneNumber ) {
    return {
      msg: "Please insert all the fields",
      success: false,
    };
  }

  if (deliveryAddress && !isFullAddress(deliveryAddress)) {
    return { msg: FULL_ADDRESS_MSG, success: false };
  }

  const updatedAccount = await prisma.account.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      dob,
      phoneNumber,
      nhsNumber,
      address,
      zipCode,
      deliveryAddress,

   
    },
  });

  revalidatePath(`/admin/${userId}/accounts`);

  if (updatedAccount) {
    return {
      msg: "Account Updated",
      success: true,
    };
  }
};

// delete user action
export const deleteUserAction = async (userId) => {
  const actor = await getAdminUser();

  if (!actor || !isAdminRole(actor.admin.role)) {
    return { success: false, message: "Unauthorized" };
  }

  const actorRole = actor.admin.role;
  const actorId = actor.admin.id;

  // ❌ No self delete
  if (actorId === userId) {
    return { success: false, message: "You cannot delete your own account" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  const targetRole = targetUser.role;

  // 🔒 ADMIN: can delete ONLY PATIENT/AUTHOR
  if (actorRole === "ADMIN") {
    const deletable = ["PATIENT", "AUTHOR"];
    if (!deletable.includes(targetRole)) {
      return {
        success: false,
        message: "Admin can only delete Patient/Author users",
      };
    }
  }

  // 🔒 SUPERADMIN: can delete anyone except self (already checked)
  // Optional safety: prevent deleting the last SUPERADMIN
  if (targetRole === "SUPERADMIN") {
    const superAdminCount = await prisma.user.count({
      where: { role: "SUPERADMIN" },
    });

    if (superAdminCount <= 1) {
      return {
        success: false,
        message: "You cannot delete the last Superadmin",
      };
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });

    revalidatePath("/admin");
    // revalidatePath("/admin/users"); // if you have a dedicated page

    return { success: true, message: "User deleted successfully" };
  } catch (err) {
    // Common: foreign key constraint if user has related records
    return {
      success: false,
      message:
        err?.code === "P2003"
          ? "Cannot delete user because related records exist"
          : "Failed to delete user",
    };
  }
};
