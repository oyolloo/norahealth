"use server";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/client/prisma";
import { signToken, verifyToken } from "@/lib/jwt/jwt";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import cloudinary from "@/lib/cloudinary";
import { resend } from "@/lib/reset";
import { sendWelcomeEmail } from "@/lib/emailTemplate";
import { resetPasswordEmailHtml } from "@/lib/emailHtml";
import { randomBytes, createHash } from "node:crypto"; // ✅ IMPORTANT

// Parse a "yyyy-MM-dd" date input to a UTC-noon Date (avoids timezone drift).
function parseYMD(ymd) {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// register action
export const registerAction = async (prevState, formData) => {
  // getting all the data from the form
  const rawEmail = formData.get("email");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = formData.get("password");
  const confirm = formData.get("confirm-password");

  // check if all fields are filled
  if (!email || !password) {
    return {
      msg: "Please enter all the fields",
      success: false,
    };
  }

  // check if user exists
  const userExists = await prisma.user.findUnique({ where: { email } });

  if (userExists) {
    return {
      msg: "Looks like you already have an account. Just log in, or reset your password if you’ve forgotten it.",
      success: false,
    };
  }

  // check if passwords are matched
  if (password !== confirm) {
    return {
      msg: "Password do to match",
      success: false,
    };
  }

  // hashing the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // creating user in database
  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  // success message
  if (user) {
    // creating safe user
    const safeUser = {
      id: user.id,
      role: user.role,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };

    // creating token with user object
    const token = await signToken(safeUser);

    // initiate cookie from next.js
    const coookiesStore = await cookies();

    // setting logged in user to cookie
    coookiesStore.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: false,
      path: "/",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30,
    });

    return {
      msg: "Account Created Successfully!",
      success: true,
    };
  }
};

// Single-step registration: create the login (User) AND the profile (Account)
// together, so an account can never exist without its details. All profile
// fields are collected on the sign-up form; nothing is saved unless the whole
// form is valid.
export const registerFullAction = async (prevState, formData) => {
  const rawEmail = formData.get("email");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = (formData.get("password") || "").toString();
  const confirm = (formData.get("confirm-password") || "").toString();
  const firstname = (formData.get("firstname") || "").toString().trim();
  const lastname = (formData.get("lastname") || "").toString().trim();
  const phone = (formData.get("phone") || "").toString().trim();
  const dobRaw = (formData.get("dob") || "").toString().trim();
  const nhs = (formData.get("nhs") || "").toString().trim();
  const address = (formData.get("address") || "").toString().trim();
  const zip = (formData.get("zip") || "").toString().trim();
  const deliveryAddress = (formData.get("deliveryAddress") || "").toString().trim();
  const deliveryZip = (formData.get("deliveryZip") || "").toString().trim();

  if (!email || !password) {
    return { success: false, msg: "Please enter your email and a password." };
  }
  if (password !== confirm) {
    return { success: false, msg: "Passwords do not match." };
  }

  // Tell the user exactly which profile field(s) are missing.
  const missing = [];
  if (!firstname) missing.push("First name");
  if (!lastname) missing.push("Last name");
  if (!phone) missing.push("Phone Number");
  if (!dobRaw) missing.push("Date of Birth");
  if (!address) missing.push("Address");
  if (!zip) missing.push("Post code");
  if (!deliveryAddress) missing.push("Delivery Address");
  if (!deliveryZip) missing.push("Delivery Post code");
  if (missing.length) {
    return {
      success: false,
      msg:
        missing.length === 1
          ? `Please fill in your ${missing[0]}.`
          : `Please fill in: ${missing.join(", ")}.`,
    };
  }

  const dob = parseYMD(dobRaw);
  if (!dob) {
    return { success: false, msg: "Please provide a valid Date of Birth." };
  }

  const userExists = await prisma.user.findUnique({ where: { email } });
  if (userExists) {
    return {
      success: false,
      msg: "Looks like you already have an account. Just log in, or reset your password if you've forgotten it.",
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  let user;
  try {
    // User + Account created atomically — no login without a profile.
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        account: {
          create: {
            firstName: firstname,
            lastName: lastname,
            phoneNumber: phone,
            secondEmail: email,
            dob,
            nhsNumber: nhs,
            address,
            zipCode: zip,
            deliveryAddress,
            deliveryZipCode: deliveryZip,
          },
        },
      },
    });
  } catch (err) {
    console.error("registerFullAction error:", err);
    return {
      success: false,
      msg: "Something went wrong creating your account. Please try again.",
    };
  }

  // Welcome email — never let an email failure block the sign-up.
  try {
    await sendWelcomeEmail({ to: user.email, name: firstname });
  } catch (welcomeErr) {
    console.error("Welcome email failed (register):", welcomeErr);
  }

  const safeUser = {
    id: user.id,
    role: user.role,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
  const token = await signToken(safeUser);
  const cookieStore = await cookies();
  cookieStore.set({
    name: "auth_token",
    value: token,
    httpOnly: true,
    secure: false,
    path: "/",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30,
  });

  return {
    success: true,
    msg: "Your account has been created. Please check your email inbox (and spam folder). Thank you.",
  };
};

// Login Action
// export const loginAction = async (prevState, formData) => {
//   // getting all the from the login form
//   const rawEmail = formData.get("email");
//   const email =
//     typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
//   const password = formData.get("password");

//   // check if all the fields are filled
//   if (!email || !password) {
//     return {
//       msg: "Please enter all the fields",
//       success: false,
//     };
//   }

//   // fetching user from database
//   const user = await prisma.user.findUnique({ where: { email } });

//   // check user is valid
//   if (!user) {
//     return {
//       msg: "Invalid Email",
//       success: false,
//     };
//   }

//   // password check
//   const passwordCheck = await bcrypt.compare(password, user.password);
//   if (!passwordCheck) {
//     return {
//       msg: "Invalid Password",
//       success: false,
//     };
//   }

//   // creating safe user
//   const safeUser = {
//     id: user.id,
//     email: user.email,
//     role: user.role,
//     isAdmin: user.isAdmin,
//     createdAt: user.createdAt,
//   };

//   // creating token with user object
//   const token = await signToken(safeUser);

//   // initiate cookie from next.js
//   const coookiesStore = await cookies();

//   // setting logged in user to cookie
//   coookiesStore.set({
//     name: "auth_token",
//     value: token,
//     httpOnly: true,
//     secure: true,
//     path: "/",
//     sameSite: "strict",
//     maxAge: 60 * 60 * 24 * 30,
//   });

//   return {
//     msg: "You are Logged In",
//     success: true,
//   };
// };

// Login Action
export const loginAction = async (prevState, formData) => {
  try {
    // getting all the from the login form
    const rawEmail = formData.get("email");
    const rawPassword = formData.get("password");

    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    const password = typeof rawPassword === "string" ? rawPassword : "";

    // check if all the fields are filled
    if (!email || !password) {
      return { msg: "Please enter all the fields", success: false };
    }

    // fetching user from database
    const user = await prisma.user.findUnique({ where: { email } });

    // check user is valid
    if (!user) {
      return { msg: "Invalid email", success: false };
    }

    // password check
    const passwordCheck = await bcrypt.compare(password, user.password);
    if (!passwordCheck) {
      return { msg: "Invalid password", success: false };
    }

    // creating safe user
    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };

    // creating token with user object
    const token = await signToken(safeUser);

    // initiate cookie from next.js (NO await)
    const cookieStore = await cookies();

    // setting logged in user to cookie
    cookieStore.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // important
      path: "/",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { msg: "You are logged in", success: true };
  } catch (err) {
    console.error("loginAction error:", err);
    return { msg: "Something went wrong. Please try again.", success: false };
  }
};

// Log out Action
export const logoutAction = async () => {
  // initiate cookie from next.js
  const coookiesStore = await cookies();

  // removing user from cookie
  coookiesStore.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "strict",
    maxAge: 0,
  });

  redirect("/login");
};

// Get Logged In User
export const loggedInUserAction = async () => {
  // initiate cookie from next.js
  const coookiesStore = await cookies();

  // getting token from cookie
  const token = coookiesStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  // verify token
  const payload = await verifyToken(token);

  if (!payload) {
    return null;
  }

  return {
    payload,
  };
};
// Get Logged In User Details
export const loggedInUserDetailsAction = async () => {
  // initiate cookie from next.js
  const coookiesStore = await cookies();

  // getting token from cookie
  const token = coookiesStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  // verify token
  const payload = await verifyToken(token);

  if (!payload) {
    return null;
  }

  const userDetails = await prisma.user.findUnique({
    where: { id: payload.id },
    include: {
      account: true,
    },
  });

  return {
    payload,
    userDetails,
  };
};

// change password

export const changePasswordAction = async (prevState, formData) => {
  try {
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    // basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return {
        msg: "Please fill in all the fields",
        success: false,
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        msg: "New passwords do not match",
        success: false,
      };
    }

    // optional: enforce 8–12 chars like your UI hint
    if (newPassword.length < 8 || newPassword.length > 12) {
      return {
        msg: "Password must be 8–12 characters long",
        success: false,
      };
    }

    // get logged in user from cookie
    const cookiesStore = await cookies();
    const token = cookiesStore.get("auth_token")?.value;

    if (!token) {
      return {
        msg: "You must be logged in to change your password",
        success: false,
      };
    }

    const payload = await verifyToken(token);

    if (!payload || !payload.id) {
      return {
        msg: "Invalid session. Please log in again.",
        success: false,
      };
    }

    // fetch user
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      return {
        msg: "User not found",
        success: false,
      };
    }

    // check current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return {
        msg: "Current password is incorrect",
        success: false,
      };
    }

    if (currentPassword === newPassword) {
      return {
        msg: "New password must be different from the current password",
        success: false,
      };
    }

    // hash and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    return {
      msg: "Password updated successfully",
      success: true,
    };
  } catch (err) {
    console.error("changePasswordAction error:", err);
    return {
      msg: "Something went wrong. Please try again later.",
      success: false,
    };
  }
};

// upload profile image
// export const uploadProfileImageAction = async (formData) => {
//   const file = formData.get("file");

//   try {
//     if (!file) {
//       return { msg: "No file selected", success: false };
//     }

//     const payload = await loggedInUserAction();
//     console.log(payload, "payload");

//     if (!payload || !payload.payload.id) {
//       return {
//         msg: "Invalid session. Please log in again.",
//         success: false,
//       };
//     }

//     const userId = payload.payload.id;

//     if (!userId) {
//       return { msg: "Unauthorized", success: false };
//     }

//     const uploadDir = path.join(process.cwd(), "public/profileImage");
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     const fileExt = path.extname(file.name);
//     const fileName = `${Date.now()}-${Math.random()
//       .toString(36)
//       .substr(2, 6)}${fileExt}`;
//     const filePath = path.join(uploadDir, fileName);

//     const buffer = Buffer.from(await file.arrayBuffer());
//     fs.writeFileSync(filePath, buffer);

//     await prisma.account.update({
//       where: { userId },
//       data: {
//         profileImage: `/profileImage/${fileName}`,
//       },
//     });
//     revalidatePath("/dashboard/profile");

//     return {
//       msg: "Profile image uploaded successfully",
//       success: true,
//       imagePath: `/profileImage/${fileName}`,
//     };
//   } catch (err) {
//     console.error("Upload error:", err);
//     return { msg: "Image upload failed", success: false };
//   }
// };

export const uploadProfileImageAction = async (formData) => {
  try {
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return { success: false, msg: "No file selected" };
    }

    const session = await loggedInUserAction();
    console.log(session, "upload");

    if (!session?.payload?.id) {
      return { success: false, msg: "Unauthorized" };
    }

    const userId = session.payload.id;

    // Convert file → buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "profile_images",
            resource_type: "image",
            transformation: [
              { width: 400, height: 400, crop: "fill" },
              { quality: "auto" },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        )
        .end(buffer);
    });

    // Save image URL
    await prisma.account.update({
      where: { userId },
      data: {
        profileImage: uploadResult.secure_url,
      },
    });

    if (session.payload.role === "AUTHOR") {
      revalidatePath("/author");
    } else {
      revalidatePath("/profile");
    }

    return {
      success: true,
      msg: "Profile image uploaded successfully",
      imagePath: uploadResult.secure_url,
    };
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return { success: false, msg: "Image upload failed" };
  }
};

// export async function forgotPasswordAction(prevState, formData) {
//   const step = formData.get("step")?.toString();
//   const email = formData.get("email")?.toString();

//   if (step === "1") {
//     // Step 1 → Check email exists
//     if (!email) return { success: false, msg: "Email is required", step: 1 };

//     const user = await prisma.user.findUnique({ where: { email } });
//     if (!user) {
//       return { success: false, msg: "Email not found", step: 1 };
//     }

//     return { success: true, msg: "Email found", step: 2 };
//   }

//   if (step === "2") {
//     // Step 2 → Update password
//     const password = formData.get("password")?.toString();
//     const confirm = formData.get("confirm")?.toString();

//     if (!password || !confirm) {
//       return { success: false, msg: "Both fields required", step: 2 };
//     }

//     if (password !== confirm) {
//       return { success: false, msg: "Passwords do not match", step: 2 };
//     }

//     if (!email) {
//       return { success: false, msg: "Something went wrong", step: 1 };
//     }

//     const hashed = await bcrypt.hash(password, 10);

//     await prisma.user.update({
//       where: { email },
//       data: { password: hashed },
//     });

//     return { success: true, msg: "Password updated", step: 3 };
//   }

//   return { success: false, msg: "Invalid step", step: 1 };
// }

export async function updateUserPasswordAction({ userId, password }) {
  try {
    if (!password || password.length < 6) {
      return {
        success: false,
        message: "Password must be at least 6 characters",
      };
    }

    const session = await loggedInUserAction();

    if (!session?.payload) {
      return {
        success: false,
        message: "Unauthorized",
      };
    }

    const actor = await prisma.user.findUnique({
      where: { id: session.payload.id },
      select: { id: true, role: true },
    });

    if (!actor) {
      return {
        success: false,
        message: "Unauthorized",
      };
    }

    // ❌ Prevent updating own password from admin panel
    if (actor.id === userId) {
      return {
        success: false,
        message: "You cannot update your own password here",
      };
    }

    // 🔐 Permission check
    if (actor.role !== "ADMIN" && actor.role !== "SUPERADMIN") {
      return {
        success: false,
        message: "Permission denied",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: "Password updated successfully",
    };
  } catch (error) {
    console.error("updateUserPasswordAction error:", error);
    return {
      success: false,
      message: "Failed to update password",
    };
  }
}


export async function forgotPasswordAction(_prev, formData) {
  try {
    const email = (formData.get("email") || "").toString().trim().toLowerCase();

    // Always return same msg (anti-enumeration)
    const ok = {
      success: true,
      msg: "If that email exists, we sent a password reset link.",
    };

    if (!email) return { success: false, msg: "Email is required." };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

     // ✅ user না পেলে register message
    if (!user) {
      return {
        success: false,
        msg: "No account found with this email. Please register first.",
      };
    }

    const rawToken = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: { tokenHash, expiresAt, userId: user.id },
    });

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: user.email,
      subject: "Reset your password",
      html: resetPasswordEmailHtml({ resetUrl }),
      text: `Reset your password (valid for 15 minutes): ${resetUrl}`,
    });

    // ✅ user পেলে success message
    return {
      success: true,
      msg: "We sent a password reset link to your email. Please check your inbox (and spam).",
    };
  } catch (err) {
    console.log("forgote err", err);
    
    return { success: false, msg: "Something went wrong." };
  }
}

export async function resetPasswordAction(_prev, formData) {
  try {
    const token = (formData.get("token") || "").toString().trim();
    const password = (formData.get("password") || "").toString();
    const confirm = (formData.get("confirm") || "").toString();

    if (!token) return { success: false, msg: "Invalid reset link." };
    if (password.length < 8)
      return { success: false, msg: "Password must be at least 8 characters." };
    if (password !== confirm)
      return { success: false, msg: "Passwords do not match." };

    // ✅ hash token using node:crypto createHash
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const prt = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!prt) return { success: false, msg: "Invalid or expired token." };
    if (prt.usedAt) return { success: false, msg: "This link was already used." };
    if (prt.expiresAt < new Date())
      return { success: false, msg: "Reset link expired." };

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: prt.userId },
        data: { password: passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: prt.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true, msg: "Password updated successfully." };
  } catch (err) {
    console.log("reset err", err);
    return { success: false, msg: "Something went wrong." };
  }
}