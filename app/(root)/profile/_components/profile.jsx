"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { LoaderIcon, PanelLeft, SquarePen } from "lucide-react";
import DateField from "@/components/global/DateField";
import { useProfile } from "@/lib/profileContext";
import { formatDate } from "@/lib/utils";
import { useActionState } from "react";
import { updateAccountAction } from "@/actions/account.action";

import { toast } from "sonner";
import { uploadProfileImageAction } from "@/actions/user.action";
import { format } from "date-fns";


const Profile = ({ account }) => {
  const [dob, setDob] = useState(null);
  const { setMenuOpen } = useProfile();
  const [uploadedImage, setUploadedImage] = useState(
    account.profileImage || null
  );
  const [uploadPending, setUploadPending] = useState(false);

  const {
    userId,
    firstName,
    lastName,
    dob: dateOfBirth,
    secondEmail,
    phoneNumber,
    nhsNumber,
    address,
    zipCode,
    profileImage,
    deliveryAddress,
    deliveryZipCode,
  } = account;

  // ---------- Account update action ----------
  const accountInitialState = {
    msg: "",
    success: false,
  };

  const [accountState, accountAction, accountPending] = useActionState(
    updateAccountAction,
    accountInitialState
  );

  // ---------- Handle profile image upload (no useActionState here) ----------
  const handleImageUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Optimistic preview
    setUploadedImage(URL.createObjectURL(selectedFile));

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setUploadPending(true);
      const res = await uploadProfileImageAction(formData);

      if (res?.success) {
        if (res.imagePath) {
          // Use the path returned from the server
          setUploadedImage(res.imagePath);
        }
        toast.success(res.msg || "Profile image uploaded successfully");
      } else {
        toast.error(res?.msg || "Image upload failed");
      }
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error("Image upload failed");
    } finally {
      setUploadPending(false);
    }
  };

  // ---------- Toasts for account update ----------
  // Depend on the whole state object (a new object is returned per submit) so
  // the toast fires on every save — even two identical successes in a row.
  useEffect(() => {
    if (!accountState?.msg) return;

    if (accountState.success) {
      toast.success(accountState.msg);
    } else {
      toast.warning(accountState.msg);
    }
  }, [accountState]);

  console.log(account, "profile");

  return (
    <div className='flex-1 space-y-6 p-[24px] md:p-[50px]'>
      {/* Header */}
      <div className='flex items-center gap-[50px]'>
        <button
          onClick={() => setMenuOpen(true)}
          className='lg:hidden w-[40px] h-[40px]  items-center gap-2 bg-[#d67b0e] text-white flex justify-center rounded-full'
        >
          <PanelLeft />
        </button>
        <h2 className='text-[#0D060C] text-[20px] md:text-[24px] font-semibold'>
          Your Profile
        </h2>
      </div>

      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <div className='relative w-[64px] lg:w-[100px] h-[64px] lg:h-[100px] rounded-full  bg-[#F6F5F4]'>
            <Image
              src={
                uploadedImage ||
                profileImage ||
                "/images/profile-placeholder.jpeg"
              }
              alt='Profile'
              fill
              className='object-cover object-top w-[64px] lg:w-[100px] h-[64px] lg:h-[100px] rounded-full border-2 border-[#CE8936]'
            />
            {/* Upload Button on Image */}
            <label className='absolute bottom-0 right-0 bg-white shadow-lg p-2 rounded-full cursor-pointer'>
              {uploadPending ? (
                <LoaderIcon className='w-4 h-4 animate-spin text-[#d67b0e]' />
              ) : (
                <SquarePen className='w-4 h-4 text-[#d67b0e]' />
              )}
              <input
                type='file'
                accept='image/*'
                onChange={handleImageUpload}
                name='profileImage'
                className='hidden'
              />
            </label>
          </div>
          <div>
            <h3 className='text-[#1F2122] text-[20px] md:text-[22px] font-semibold'>
              {firstName} {lastName}
            </h3>
            <p className='text-sm text-[#3A3D42]'>
              DOB: {formatDate(dateOfBirth)}
            </p>
          </div>
        </div>
      </div>

      {/* FORM */}
      <form className='space-y-6' action={accountAction}>
        <input type='hidden' name='userId' value={userId} />
        <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
          {/* First / Last name */}
          <div className='col-span-4 mt-3'>
            <h2 className='text-theme text-2xl font-semibold'>
              Personal Profile
            </h2>
          </div>
          <div className='col-span-4 md:col-span-2'>
            <label
              htmlFor='firstName'
              className='block text-base mb-2 text-[#0D060C]'
            >
              First name
            </label>
            <input
              id='firstName'
              type='text'
              name='firstname'
              defaultValue={firstName}
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          <div className='col-span-4 md:col-span-2'>
            <label
              htmlFor='lastName'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Last name
            </label>
            <input
              id='lastName'
              type='text'
              name='lastName'
              defaultValue={lastName}
              className='bg-white border border-[#F0E3D6] text-[#3A3D42] w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>

          {/* Email / Phone */}
          <div className='col-span-4 md:col-span-2'>
            <label
              htmlFor='email'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Email Address
            </label>
            <input
              id='email'
              defaultValue={secondEmail}
              name='email'
              type='email'
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          <div className='col-span-4 md:col-span-2'>
            <label
              htmlFor='phone'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Phone Number
            </label>
            <input
              id='phone'
              name='phone'
              type='tel'
              defaultValue={phoneNumber}
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          <div className='col-span-4 md:col-span-2'>
            {/* DOB / NHS */}
            <input
              type='hidden'
              name='dob'
              value={
                dob
                  ? format(dob, "yyyy-MM-dd")
                  : dateOfBirth
                    ? format(new Date(dateOfBirth), "yyyy-MM-dd")
                    : ""
              }
            />
            <DateField
              id='dob'
              label='Date of Birth'
              selected={dob}
              onChange={setDob}
              placeholder={formatDate(dateOfBirth)}
              className='md:col-span-2 '
              name='dob'
              bg='bg-white border border-[#EEE0CF] text-black'
            />
          </div>

          <div className='col-span-4 md:col-span-2'>
            <label
              htmlFor='nhs'
              className='block text-base mb-2 text-[#0D060C]'
            >
              NHS number
            </label>
            <input
              id='nhs'
              type='text'
              defaultValue={nhsNumber}
              name='nhs'
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>

          {/* Home address / Zip */}
          <div className='col-span-4 md:col-span-3'>
            <label
              htmlFor='homeAddress'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Home Address
            </label>
            <input
              id='homeAddress'
              type='text'
              defaultValue={address}
              name='address'
              placeholder='Wellin Lane, Edwalton, United Kingdom'
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          <div className='col-span-4 md:col-span-1'>
            <label
              htmlFor='homeZip'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Home Post Code
            </label>
            <input
              id='homeZip'
              type='text'
              defaultValue={zipCode}
              name='zip'
              placeholder='NG12 4AS'
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          <div className='col-span-4 md:col-span-3'>
            <label
              htmlFor='deliveryAddress'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Delivery Address
            </label>
            <input
              id='deliveryAddress'
              type='text'
              defaultValue={deliveryAddress}
              name='deliveryAddress'
              placeholder='Wellin Lane, Edwalton, United Kingdom'
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          <div className='col-span-4 md:col-span-1'>
            <label
              htmlFor='deliveryZip'
              className='block text-base mb-2 text-[#0D060C]'
            >
              Delivery Post code
            </label>
            <input
              id='deliveryZip'
              type='text'
              defaultValue={deliveryZipCode}
              name='deliveryZip'
              placeholder='NG12 4AS'
              className='bg-white border border-[#EEE0CF] text-black w-full py-[15px] px-[16px] rounded-[6px]'
            />
          </div>
          {/* Inline status — persistent confirmation after saving */}
          {accountState?.msg && (
            <div className='col-span-4 md:col-span-4'>
              <p
                className={`text-sm font-medium rounded-[8px] px-4 py-3 ${
                  accountState.success
                    ? "bg-[#E7F5EC] text-[#1B7F4B]"
                    : "bg-[#FBEFE2] text-[#B4690E]"
                }`}
              >
                {accountState.success ? "✓ " : ""}
                {accountState.msg}
              </p>
            </div>
          )}

          {/* Save button */}
          <div className='col-span-4 md:col-span-4'>
            <button
              type='submit'
              className=' text-white inline-block bg-theme text-[16px] font-medium py-4 px-9 rounded-full hover:bg-[#491F40] transition group duration-300 sm:min-w-[200px] min-w-full cursor-pointer '
              disabled={accountPending}
            >
              <span className='flex items-center justify-center'>
                {accountPending ? (
                  <span className='ml-2 -rotate-45 group-hover:rotate-0 transition duration-300'>
                    <LoaderIcon
                      role='status'
                      aria-label='Loading'
                      className='size-6 animate-spin mx-auto'
                    />
                  </span>
                ) : (
                  <span>Update Profile</span>
                )}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Profile;
