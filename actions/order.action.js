"use server";

import { prisma } from "@/lib/client/prisma";
import { getAdminUser } from "./admin.action";
import { revalidatePath } from "next/cache";
import { loggedInUserAction } from "./user.action";
import { Resend } from "resend";
import { orderEmailTemplate, orderStatusEmailTemplate } from "@/lib/emailTemplate";
import { createRoyalMailOrder, isRoyalMailConfigured } from "@/lib/royalMail";

const resend = new Resend(process.env.RESEND_API_KEY);
// Build date range filter by createdAt
function buildCreatedAtRange({ year, month, day }) {
  const y = year ? Number(year) : null;
  const m = month ? Number(month) : null;
  const d = day ? Number(day) : null;

  if (!y) return null;

  // Use UTC range to stay consistent in DB timestamps
  let start;
  let end;

  if (y && !m) {
    start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));
  } else if (y && m && !d) {
    start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    end = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // next month
  } else {
    start = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
    end = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + 1, 0, 0, 0)); // next day
  }

  return { gte: start, lt: end };
}
// create order by admin
export const createOrderByAdmin = async (prevState, formData) => {
  const userId = Number(formData.get("userId"));
  const medicineName = formData.get("medicineName");
  const trackingId = formData.get("trackingId");
  const status = formData.get("status");

  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, message: "Unauthorized. User is not admin" };
  }

  if (!medicineName || !status) {
    return {
      msg: "Please insert all the fields",
      success: false,
    };
  }

  // 1️⃣ Get customer info
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      account: {
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
          deliveryAddress: true,
          address: true,
          deliveryZipCode: true,
        },
      },
    },
  });

  if (!customer?.email) {
    return { success: false, msg: "Customer email not found" };
  }

  const order = await prisma.order.create({
    data: {
      userId,
      medicineName,
      trackingId,
      status,
    },
  });

  // 📦 Auto-dispatch: when an order is created as "Awaiting Dispatch"
  // (clinicalreview) with no manual tracking, create the shipment via Click &
  // Drop and, ONLY if a tracking number comes back, flip it to "Posted via
  // Royal Mail". If RM isn't configured, fails, or returns no tracking number,
  // the order safely stays in "Awaiting Dispatch" (nothing breaks).
  if (order && status === "clinicalreview" && !trackingId && isRoyalMailConfigured()) {
    try {
      const { trackingNumber } = await createRoyalMailOrder({
        order,
        customer,
      });
      if (trackingNumber) {
        await prisma.order.update({
          where: { id: order.id },
          data: { trackingId: trackingNumber, status: "posted" },
        });
      }
    } catch (err) {
      console.error("Royal Mail order creation failed:", err);
      // order is created, so we don’t fail the action
    }
  }



  // 3️⃣ Send confirmation email
  try {
    await resend.emails.send({
      from: "Nora Health <contact@norahealth.co.uk>",
      to: customer.email,
      subject: "Your Order Has Been Confirmed",
      html: orderEmailTemplate({
        firstName: customer.account?.firstName,
        phoneNumber: customer.account?.phoneNumber,
        deliveryAddress:
          customer.account?.deliveryAddress || customer.account?.address,
      }),
    });
  } catch (err) {
    console.error("Order email failed:", err);
    // order is created, so we don’t fail the action
  }

  revalidatePath(`/admin/${userId}/orders`);

  if (order) {
    return {
      msg: "Order Created",
      success: true,
    };
  }
};

// get all user orders by admin

// export async function getAllOrdersAction({ year, month, day } = {}) {
//   try {
//     const user = await getAdminUser();

//     const isAdmin = user?.admin?.isAdmin || false;

//     if (!isAdmin) {
//       return { success: false, message: "Unauthorized. User is not admin" };
//     }
//     const createdAtRange = buildCreatedAtRange({ year, month, day });

//     const where = {};
//     if (createdAtRange) where.createdAt = createdAtRange;

//     const orders = await prisma.order.findMany({
//       where,
//       include: {
//         user: {
//           include: { account: true },
//         },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     // Flatten for table
//     const formatted = orders.map((o) => {
//       const acc = o.user?.account;

//       const fullName =
//         acc?.firstName || acc?.lastName
//           ? `${acc?.firstName ?? ""} ${acc?.lastName ?? ""}`.trim()
//           : "N/A";

//       return {
//         id: o.id,
//         medicineName: o.medicineName,
//         trackingId: o.trackingId,
//         status: o.status,
//         createdAt: o.createdAt.toISOString(),

//         userId: o.userId,
//         email: o.user?.email ?? "N/A",
//         fullName,
//         phoneNumber: acc?.phoneNumber ?? "N/A",
//       };
//     });

//     return { success: true, orders: formatted };
//   } catch (err) {
//     console.error(err);
//     return { success: false, orders: [], message: "Failed to fetch orders" };
//   }
// }
// actions/order.action.js (server)
export async function getAllOrdersAction({
  year,
  month,
  day,
  status,
  email,
  page = 0,
  pageSize = 10,
} = {}) {
  try {
    const user = await getAdminUser();
    // console.log("user", user);
    
    const isAdmin = user?.admin?.isAdmin || false;

    if (!isAdmin) {
      return { success: false, message: "Unauthorized. User is not admin" };
    }

    const where = {};

    // Date range filter (your existing helper)
    const createdAtRange = buildCreatedAtRange({ year, month, day });
    if (createdAtRange) where.createdAt = createdAtRange;

    // Status filter
    if (status && status !== "all") {
      where.status = status; // "clinicalreview" | "posted" | "delivered"
    }

    // Search filter — matches email, patient name, medicine, tracking id, or
    // the order id (numeric). The `email` param name is kept for back-compat.
    const q = email ? String(email).trim() : "";
    if (q) {
      const or = [
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { account: { firstName: { contains: q, mode: "insensitive" } } } },
        { user: { account: { lastName: { contains: q, mode: "insensitive" } } } },
        { medicineName: { contains: q, mode: "insensitive" } },
        { trackingId: { contains: q, mode: "insensitive" } },
      ];
      const n = Number(q);
      if (Number.isInteger(n) && String(n) === q) or.push({ id: n });
      where.OR = or;
    }

    const safePage = Number.isFinite(Number(page)) ? Number(page) : 0;
    const safePageSize = Number.isFinite(Number(pageSize))
      ? Number(pageSize)
      : 10;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            include: { account: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: safePage * safePageSize,
        take: safePageSize,
      }),
      prisma.order.count({ where }),
    ]);

    // Flatten for table
    const formatted = orders.map((o) => {
      const acc = o.user?.account;

      const fullName =
        acc?.firstName || acc?.lastName
          ? `${acc?.firstName ?? ""} ${acc?.lastName ?? ""}`.trim()
          : "N/A";

      return {
        id: o.id,
        medicineName: o.medicineName,
        trackingId: o.trackingId,
        status: o.status,
        createdAt: o.createdAt.toISOString(),

        userId: o.userId,
        email: o.user?.email ?? "N/A",
        fullName,
        phoneNumber: acc?.phoneNumber ?? "N/A",
      };
    });

    return {
      success: true,
      orders: formatted,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  } catch (err) {
    console.error("getAllOrdersAction error:", err);
    return {
      success: false,
      orders: [],
      total: 0,
      message: err?.message || "Failed to fetch orders",
    };
  }
}

// get all orders by admin
export const getAllOrders = async (userId) => {
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

  const orders = await prisma.order.findMany({
    where: { userId: Number(userId) },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    user,
    orders,
  };
};
const RECENT_DAYS = 45;
const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

// get order by user
export const getPastOrderByUser = async () => {
  const payload = await loggedInUserAction();

  const userId = payload?.payload?.id;
  if (!userId) {
    return { msg: "User not logged In", success: false };
  }

  const RECENT_DAYS = 45;
  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      userId: Number(userId),
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, msg: "OK", orders };
};

export const getRecentOrderByUser = async () => {
  const payload = await loggedInUserAction();

  const userId = payload?.payload?.id;
  if (!userId) {
    return { msg: "User not logged In", success: false };
  }

  

  const orders = await prisma.order.findMany({
    where: {
      userId: Number(userId),
      
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, msg: "OK", orders };
};

// export const updateOrderStatus = async (formData) => {
//   const orderId = formData.get("orderId");
//   const status = formData.get("status");
//   const trackingId = formData.get("trackingId");
//   const adminUser = await getAdminUser();
//   if (!adminUser?.admin?.isAdmin) {
//     return { success: false, msg: "Unauthorized. Not an admin." };
//   }
//   if (!trackingId || !String(trackingId).trim()) {
//     return { success: false, msg: "trackingId is required" };
//   }

//   const order = await prisma.order.update({
//     where: { id: Number(orderId) },
//     data: { status, trackingId },
//   });

//   if (!order) {
//     return {
//       msg: "Order not found",
//       success: false,
//     };
//   }
//   revalidatePath(`/admin`);
//   revalidatePath(`/admin/orders`);

//   if (order) {
//     return {
//       msg: "Order Status Updated Successfully",
//       success: true,
//     };
//   }
// };

export const updateOrderStatus = async (prevState, formData) => {
  const orderId = formData.get("orderId");
  const status = String(formData.get("status") || "").trim();
  const trackingIdRaw = formData.get("trackingId");
  const trackingId = String(trackingIdRaw || "").trim();

  const adminUser = await getAdminUser();
  if (!adminUser?.admin?.isAdmin) {
    return { success: false, msg: "Unauthorized. Not an admin." };
  }

  if (!orderId) {
    return { success: false, msg: "orderId is required" };
  }

  // Require trackingId only when status is "posted"
  // if (status === "posted" && !trackingId) {
  //   return {
  //     success: false,
  //     msg: "Tracking ID is required when status is posted.",
  //   };
  // }

  // Optional: also require for delivered
  // if ((status === "posted" || status === "delivered") && !trackingId) {
  //   return { success: false, msg: "Tracking ID is required for posted/delivered status." };
  // }

  // ✅ load existing order (need userId + current trackingId before deciding on Royal Mail)
  const existing = await prisma.order.findUnique({
    where: { id: Number(orderId) },
  });
  if (!existing) {
    return { success: false, msg: "Order not found" };
  }

  // ✅ fetch customer email/name + address fields (needed for Royal Mail recipient)
  const customer = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: {
      email: true,
      account: {
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
          deliveryAddress: true,
          address: true,
          deliveryZipCode: true,
        },
      },
    },
  });

  // Build update data conditionally
  const data = { status };
  if (trackingId) data.trackingId = trackingId;

  // 📦 Royal Mail: when an order is marked "posted" and has no tracking number yet,
  // create the shipment via Click & Drop and store the returned tracking number.
  let rmWarning = null;
  const effectiveTracking = trackingId || existing.trackingId;
  if (status === "posted" && !effectiveTracking && isRoyalMailConfigured()) {
    try {
      const { trackingNumber } = await createRoyalMailOrder({
        order: existing,
        customer,
      });
      if (trackingNumber) {
        data.trackingId = trackingNumber;
      } else {
        rmWarning =
          "Royal Mail order created but returned no tracking number (check service code).";
      }
    } catch (err) {
      console.error("Royal Mail order creation failed:", err);
      rmWarning = "Status updated, but Royal Mail tracking could not be generated.";
    }
  }

  const order = await prisma.order.update({
    where: { id: Number(orderId) },
    data,
  });

  if (!order) {
    return { success: false, msg: "Order not found" };
  }

  // ✅ send email (don’t block update if email fails)
  if (customer?.email) {
    const s = String(order.status || "").toLowerCase();
    const emailSubject =
      s === "declined"
        ? "Contraception Request Declined"
        : s === "posted"
        ? "Contraception Posted"
        : `Order #${order.id} status: ${order.status}`;
    try {
      await resend.emails.send({
        from: "Nora Health <contact@norahealth.co.uk>",
        to: customer.email,
        subject: emailSubject,
        replyTo: "contact@norahealth.co.uk",
        html: orderStatusEmailTemplate({
          firstName: customer.account?.firstName,
          orderId: order.id,
          status: order.status,
          medicineName: order.medicineName,
          trackingId: order.trackingId,
          deliveryAddress:
            customer.account?.deliveryAddress || customer.account?.address,
        }),
      });
    } catch (err) {
      console.error("Status update email failed:", err);
    }
  }

  revalidatePath(`/admin`);
  revalidatePath(`/admin/orders`);

  return {
    success: true,
    msg: rmWarning || "Order Status Updated Successfully",
    trackingId: order.trackingId,
    warning: rmWarning || undefined,
  };
};

export const deleteOrder = async (formData) => {
  const orderId = formData.get("orderId");

  const order = await prisma.order.delete({
    where: { id: Number(orderId) },
  });

  const adminUser = await getAdminUser();
  if (!adminUser?.admin?.isAdmin) {
    return { success: false, msg: "Unauthorized. Not an admin." };
  }

  if (!order) {
    return {
      msg: "Order not found",
      success: false,
    };
  }
  revalidatePath(`/admin`);

  if (order) {
    return {
      msg: "Order Deleted Successfully",
      success: true,
    };
  }
};
