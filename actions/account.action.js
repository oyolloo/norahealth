"use server";

import { revalidatePath } from "next/cache";
import { loggedInUserAction } from "./user.action";
import { prisma } from "@/lib/client/prisma";
import { FULL_ADDRESS_MSG, isFullAddress } from "@/lib/addressLookup";
import { getAdminUser } from "./admin.action";
import { sendWelcomeEmail } from "@/lib/emailTemplate";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateInput = (value) => {
  if (!value) return null;

  const input = value instanceof Date ? value.toISOString() : value.toString().trim();
  if (!input) return null;

  if (DATE_ONLY_PATTERN.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12)
  );
};

// create account action
export const createAccountAction = async (prevState, formData) => {
  const firstname = (formData.get("firstname") || "").toString().trim();
  const lastname = (formData.get("lastname") || "").toString().trim();
  const phone = (formData.get("phone") || "").toString().trim();
  const secondemail = (formData.get("secondemail") || "").toString().trim();
  const dob = parseDateInput(formData.get("dob")) ?? undefined;
  const nhs = (formData.get("nhs") || "").toString().trim();
  const address = (formData.get("address") || "").toString().trim();
  const zip = (formData.get("zip") || "").toString().trim();
  const deliveryAddress = (formData.get("deliveryAddress") || "").toString().trim();
  const deliveryZip = (formData.get("deliveryZip") || "").toString().trim();

  // Tell the user exactly which required field(s) are missing, instead of a
  // generic "Please insert all the fields" — the Date of Birth in particular
  // shows a realistic-looking placeholder, so people think it's filled in.
  const missing = [];
  if (!firstname) missing.push("First name");
  if (!lastname) missing.push("Last name");
  if (!phone) missing.push("Phone Number");
  if (!secondemail) missing.push("Email address");
  if (!dob) missing.push("Date of Birth");
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

  if (!isFullAddress(deliveryAddress)) {
    return { success: false, msg: FULL_ADDRESS_MSG };
  }

  // getting the user from cookie
  const payload = await loggedInUserAction();

  // checking the user is logged in
  if (!payload?.payload?.email) {
    return {
      success: false,
      msg: "User not found",
    };
  }

  const user = payload?.payload;

  const accountData = {
    // personal
    firstName: firstname,
    lastName: lastname,
    phoneNumber: phone,
    secondEmail: secondemail,
    dob: dob,
    nhsNumber: nhs,
    address: address,
    zipCode: zip,
    deliveryAddress: deliveryAddress,
    deliveryZipCode: deliveryZip,
  };

  try {
    await prisma.account.upsert({
      where: { userId: user.id },
      update: accountData,
      create: { userId: user.id, ...accountData },
    });

    // Send the personalised welcome email now that we have the patient's name.
    // Never let an email failure block the save.
    try {
      await sendWelcomeEmail({ to: user.email, name: firstname });
    } catch (welcomeErr) {
      console.error("Welcome email failed (account registration):", welcomeErr);
    }

    return {
      msg: "Your account has been created. Please check your email inbox (and spam folder). Thank you.",
      success: true,
    };
  } catch (err) {
    console.error("createAccountAction error:", err);
    return {
      success: false,
      msg: "Failed to save your details. Please try again.",
    };
  }
};

// fetch account of logged in user
export const getUserAccount = async () => {
  // getting the user from cookie
  const payload = await loggedInUserAction();

  // checking the user is logged in
  if (!payload?.payload?.email) {
    return {
      success: false,
      msg: "User not found",
    };
  }

  const user = payload?.payload;

  // fetch logged in user account
  const account = await prisma.account.findUnique({
    where: {
      userId: user.id,
    },
  });

  return {
    account,
  };
};

// update account
export const updateAccountByAdmin = async (prevState, formData) => {
  const userId = Number(formData.get("userId"));
  const firstName = (formData.get("firstName") || "").toString().trim();
  const lastName = (formData.get("lastName") || "").toString().trim();
  const dobValue = formData.get("dob");
  const dob = parseDateInput(dobValue);
  // phoneNumber is optional (a new patient may not have one yet); the DB column
  // is non-null, so fall back to "" instead of blocking the save.
  const phoneNumber = (formData.get("phoneNumber") || "").toString().trim();
  const nhsNumber = (formData.get("nhsNumber") || "").toString().trim();
  const address = (formData.get("address") || "").toString().trim();
  const zipCode = (formData.get("zipCode") || "").toString().trim();
  const deliveryAddress = (formData.get("deliveryAddress") || "").toString().trim();
  const deliveryZipCode = (formData.get("deliveryZipCode") || "").toString().trim();
  const user = await getAdminUser();

  const isAdmin = user?.admin?.isAdmin || false;

  if (!isAdmin) {
    return { success: false, msg: "Unauthorized. User is not admin" };
  }

  if (!Number.isInteger(userId)) {
    return { success: false, msg: "Invalid user." };
  }

  if (deliveryAddress && !isFullAddress(deliveryAddress)) {
    return { success: false, msg: FULL_ADDRESS_MSG };
  }

  // Only First Name, Last Name and Date of Birth are truly required.
  if (!firstName || !lastName || !dob || Number.isNaN(dob.getTime())) {
    return {
      msg: "First Name, Last Name and Date of Birth are required.",
      success: false,
    };
  }

  try {
    await prisma.account.upsert({
      where: { userId: userId },
      update: {
        firstName,
        lastName,
        dob,
        phoneNumber,
        nhsNumber,
        address,
        zipCode,
        deliveryAddress,
        deliveryZipCode,
      },
      create: {
        userId,
        firstName,
        lastName,
        dob,
        phoneNumber,
        nhsNumber,
        address,
        zipCode,
        deliveryAddress,
        deliveryZipCode,
        secondEmail: "",
      },
    });

    revalidatePath(`/admin/${userId}/account`);

    return {
      msg: "Account Updated",
      success: true,
    };
  } catch (err) {
    console.error("updateAccountByAdmin error:", err);
    return {
      msg: "Failed to save account. Please try again.",
      success: false,
    };
  }
};

export const getUserAccountInfobyid = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      email: true,
      account: {
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
          secondEmail: true,
          dob: true,
          nhsNumber: true,
          address: true,
          zipCode: true,
          profileImage: true,
          deliveryAddress: true,
          deliveryZipCode: true,
        }
      }
    },
  });

  if (!user) {
    return {
      success: false,
      message: "User not found",
    };
  }

  return {
    success: true,
    user: user,
  };
};

// update account
export const updateAccountAction = async (prevState, formData) => {
  const payload = await loggedInUserAction()

  if (!payload?.payload?.email) {
    return {
      success: false,
      msg: 'User not found',
    }
  }

  const loggedInUserId = payload?.payload?.id

  const userId = formData.get('userId').toString()
  const firstname = formData.get('firstname')
  const lastName = formData.get('lastName')
  const email = formData.get('email')
  const phone = formData.get('phone')
  const dob = parseDateInput(formData.get('dob'))
  const nhs = formData.get('nhs')
  const address = formData.get('address')
  const zip = formData.get('zip')
  const deliveryAddress = formData.get('deliveryAddress')
  const deliveryZip = formData.get('deliveryZip')
  // const weight = formData.get('weight')
  // const height = formData.get('height')
  // const whdate = new Date(formData.get('whdate'))
  // const bptop = formData.get('bptop')
  // const bpbottom = formData.get('bpbottom')
  // const bpdate = new Date(formData.get('bpdate'))
  // const medicalconditions = formData.get('medicalconditions')
  // const currentmedicines = formData.get('currentmedicines')

  if (loggedInUserId.toString() !== userId) {
    return null
  }

  if (deliveryAddress && !isFullAddress(deliveryAddress)) {
    return { success: false, msg: FULL_ADDRESS_MSG }
  }

  const updatedAcount = await prisma.account.upsert({
    where: {
      userId: loggedInUserId,
    },

    update: {
      // personal
      firstName: firstname,
      lastName: lastName,
      phoneNumber: phone,
      secondEmail: email,
      dob: dob,
      nhsNumber: nhs,
      address: address,
      zipCode: zip,
      deliveryAddress: deliveryAddress,
      deliveryZipCode: deliveryZip,

      // health
      // weight: weight,
      // height: height,
      // weightHeightCheckDate: whdate,
      // bpTop: bptop,
      // bpBottom: bpbottom,
      // bpCheckDate: bpdate,
      // medicalConditions: medicalconditions,
      // currentMedicines: currentmedicines,
    },

    create: {
      userId: loggedInUserId,
      // personal
      firstName: firstname,
      lastName: lastName,
      phoneNumber: phone,
      secondEmail: email,
      dob: dob,
      nhsNumber: nhs,
      address: address,
      zipCode: zip,
      deliveryAddress: deliveryAddress,
      deliveryZipCode: deliveryZip,

      // health
      // weight: weight,
      // height: height,
      // weightHeightCheckDate: whdate,
      // bpTop: bptop,
      // bpBottom: bpbottom,
      // bpCheckDate: bpdate,
      // medicalConditions: medicalconditions,
      // currentMedicines: currentmedicines,
    },
  })

  revalidatePath('/profile')
  revalidatePath('/admin/profile')

  if (updatedAcount) {
    return {
      msg: 'Account Updated!',
      success: true,
    }
  }
}

