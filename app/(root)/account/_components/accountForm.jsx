"use client";
import { useState, useEffect, startTransition } from "react";
import DateField from "@/components/global/DateField";
import { useActionState } from "react";
import { createAccountAction } from "@/actions/account.action";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LoaderIcon } from "lucide-react";
import { format } from "date-fns";

const AccountForm = ({ user }) => {
  const router = useRouter();

  const [dob, setDob] = useState(null);

  // Controlled fields so the form keeps what the user typed. We submit via
  // onSubmit + a manual dispatch (NOT the <form action> prop) because React 19
  // automatically resets a form after its `action` runs — that reset wiped the
  // whole form on a validation error, forcing people to re-enter everything
  // just because one field (e.g. DoB) was missing.
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    phone: "",
    secondemail: user?.email || "",
    nhs: "",
    address: "",
    zip: "",
    deliveryAddress: "",
    deliveryZip: "",
  });

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const initialState = {
    msg: "",
    success: false,
  };

  const [state, action, loading] = useActionState(
    createAccountAction,
    initialState
  );

  const onSubmit = (e) => {
    e.preventDefault(); // stop native submit + React's post-action form reset
    const fd = new FormData();
    fd.set("firstname", form.firstname);
    fd.set("lastname", form.lastname);
    fd.set("phone", form.phone);
    fd.set("secondemail", form.secondemail);
    fd.set("dob", dob ? format(dob, "yyyy-MM-dd") : "");
    fd.set("nhs", form.nhs);
    fd.set("address", form.address);
    fd.set("zip", form.zip);
    fd.set("deliveryAddress", form.deliveryAddress);
    fd.set("deliveryZip", form.deliveryZip);
    startTransition(() => {
      action(fd);
    });
  };

  useEffect(() => {
    if (state.msg) {
      if (state.success) {
        toast.success(state.msg);
        router.push("/health");
      } else {
        toast.warning(state.msg);
      }
    }
    state.msg = "";
  }, [state.msg]);

  return (
    <form onSubmit={onSubmit}>
      {/* PERSONAL DETAILS */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        {/* First Name */}
        <div className='md:col-span-2'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='firstName'
          >
            First name
          </label>
          <input
            name='firstname'
            type='text'
            id='firstName'
            placeholder='First name'
            value={form.firstname}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        {/* Last Name */}
        <div className='md:col-span-2'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='lastName'
          >
            Last name
          </label>
          <input
            type='text'
            name='lastname'
            id='lastName'
            placeholder='Last name'
            value={form.lastname}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        {/* Phone Number */}
        <div className='md:col-span-2'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='phone'
          >
            Phone Number
          </label>
          <input
            type='tel'
            name='phone'
            id='phone'
            placeholder='Phone Number'
            value={form.phone}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        {/* Email */}
        <div className='md:col-span-2'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='email'
          >
            Email address
          </label>
          <input
            name='secondemail'
            type='email'
            id='email'
            value={form.secondemail}
            onChange={handleChange}
            placeholder='Email address'
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        <DateField
          id='dob'
          label='Date of Birth'
          selected={dob}
          onChange={setDob}
          name='dob'
          placeholder='Select date of birth'
          className='md:col-span-2'
          bg='bg-[#F6F5F4] border-0'
        />

        {/* NHS Number */}
        <div className='md:col-span-2'>
          <label className='block text-base mb-2 text-[#0D060C]' htmlFor='nhs'>
            NHS Number (Optional)
          </label>
          <input
            type='text'
            name='nhs'
            id='nhs'
            placeholder='10 Digits NHS Number'
            value={form.nhs}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        {/* Address → 75% */}
        <div className='md:col-span-3'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='address'
          >
            Home Address
          </label>
          <input
            type='text'
            name='address'
            id='address'
            placeholder='Home Address'
            value={form.address}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        {/* Zip code → 25% */}
        <div className='md:col-span-1'>
          <label className='block text-base mb-2 text-[#0D060C]' htmlFor='zip'>
            Home Post Code
          </label>
          <input
            type='text'
            name='zip'
            id='zip'
            placeholder='Home Post Code'
            value={form.zip}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>
        {/* Delivery Address → 75% */}
        <div className='md:col-span-3'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='deliveryAddress'
          >
            Delivery Address
          </label>
          <input
            type='text'
            name='deliveryAddress'
            id='deliveryAddress'
            placeholder='Delivery Address'
            value={form.deliveryAddress}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>

        {/* Delivery Post code → 25% */}
        <div className='md:col-span-1'>
          <label
            className='block text-base mb-2 text-[#0D060C]'
            htmlFor='deliveryZip'
          >
            Delivery Post code
          </label>
          <input
            type='text'
            name='deliveryZip'
            id='deliveryZip'
            placeholder='Delivery Post code'
            value={form.deliveryZip}
            onChange={handleChange}
            className='bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[18px] px-[16px] rounded-[6px]'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mt-8'>
        {/* Submit button full row */}
        <div className='md:col-span-4'>
          <button
            type='submit'
            className=' text-white inline-block bg-theme text-[16px] font-medium py-4 px-9 rounded-full hover:bg-[#491F40] transition group duration-300 w-full cursor-pointer '
          >
            <span className='flex items-center justify-center'>
              {loading ? (
                <span className='ml-2 -rotate-45 group-hover:rotate-0 transition duration-300'>
                  <LoaderIcon
                    role='status'
                    aria-label='Loading'
                    className='size-6 animate-spin mx-auto'
                  />
                </span>
              ) : (
                <span>Create Account</span>
              )}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
};

export default AccountForm;
