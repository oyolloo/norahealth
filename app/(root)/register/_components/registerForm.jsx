"use client";

import { useState, useEffect, startTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderIcon } from "lucide-react";
import { registerFullAction } from "@/actions/user.action";
import DateField from "@/components/global/DateField";
import AddressLookupInput from "@/components/global/AddressLookupInput";
import { toast } from "sonner";
import { format } from "date-fns";

const inputClass =
  "bg-[#F6F5F4] text-[#3A3D42] placeholder:text-[#3A3D42] w-full py-[16px] md:py-[18px] px-[16px] rounded-[6px] outline-none focus:ring-2 focus:ring-[#3A3D42]/40";

const STEPS = [
  { key: "personal", label: "Your details" },
  { key: "address", label: "Address" },
  { key: "login", label: "Login details" },
];

const RegisterForm = () => {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [dob, setDob] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Controlled so nothing is lost when moving between steps or on a validation
  // error. All three steps live in one form; the account is created in one go
  // on the final submit, so an account can never exist without full details.
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm: "",
    firstname: "",
    lastname: "",
    phone: "",
    nhs: "",
    address: "",
    zip: "",
    deliveryAddress: "",
    deliveryZip: "",
  });

  const [sameAsHome, setSameAsHome] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (sameAsHome && name === "address") next.deliveryAddress = value;
      if (sameAsHome && name === "zip") next.deliveryZip = value;
      return next;
    });
  };

  const toggleSameAsHome = (checked) => {
    setSameAsHome(checked);
    if (checked)
      setForm((prev) => ({
        ...prev,
        deliveryAddress: prev.address,
        deliveryZip: prev.zip,
      }));
  };

  const initialState = { msg: "", success: false };
  const [state, action, loading] = useActionState(
    registerFullAction,
    initialState
  );

  const isLastStep = step === STEPS.length - 1;

  const missingForStep = (idx) => {
    const missing = [];
    if (idx === 0) {
      if (!form.firstname.trim()) missing.push("First name");
      if (!form.lastname.trim()) missing.push("Last name");
      if (!form.phone.trim()) missing.push("Phone Number");
      if (!dob) missing.push("Date of Birth");
    } else if (idx === 1) {
      if (!form.address.trim()) missing.push("Home Address");
      if (!form.zip.trim()) missing.push("Home Post Code");
      if (!form.deliveryAddress.trim()) missing.push("Delivery Address");
      if (!form.deliveryZip.trim()) missing.push("Delivery Post code");
    }
    return missing;
  };

  const warnMissing = (missing) =>
    toast.warning(
      missing.length === 1
        ? `Please fill in your ${missing[0]}.`
        : `Please fill in: ${missing.join(", ")}.`
    );

  const goNext = () => {
    const missing = missingForStep(step);
    if (missing.length) {
      warnMissing(missing);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (e) => {
    e.preventDefault();
    // Pressing Enter on an earlier step just advances instead of submitting.
    if (!isLastStep) {
      goNext();
      return;
    }
    if (!form.email.trim() || !form.password || !form.confirm) {
      toast.warning("Please enter your email and a password.");
      return;
    }
    if (form.password !== form.confirm) {
      toast.warning("Passwords do not match.");
      return;
    }
    const fd = new FormData();
    fd.set("email", form.email);
    fd.set("password", form.password);
    fd.set("confirm-password", form.confirm);
    fd.set("firstname", form.firstname);
    fd.set("lastname", form.lastname);
    fd.set("phone", form.phone);
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
        // New patients go straight to ordering (client request); health details
        // stay optional and can be filled in later from the profile.
        router.push("/booking/order");
      } else {
        toast.warning(state.msg);
      }
    }
    state.msg = "";
  }, [state.msg]);

  return (
    <form onSubmit={onSubmit}>
      {/* Step header + progress */}
      <div className='mb-6'>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-sm font-medium text-[#3A3D42]'>
            Step {step + 1} of {STEPS.length}
          </p>
          <p className='text-sm font-semibold text-[#0D060C]'>
            {STEPS[step].label}
          </p>
        </div>
        <div className='flex gap-2'>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-theme" : "bg-[#EEE0CF]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* STEP 1 — Personal details */}
      {step === 0 && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
          <div>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='firstName'
            >
              First name
            </label>
            <input
              type='text'
              id='firstName'
              name='firstname'
              placeholder='First name'
              value={form.firstname}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='lastName'
            >
              Last name
            </label>
            <input
              type='text'
              id='lastName'
              name='lastname'
              placeholder='Last name'
              value={form.lastname}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='phone'
            >
              Phone Number
            </label>
            <input
              type='tel'
              id='phone'
              name='phone'
              placeholder='Phone Number'
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <DateField
            id='dob'
            label='Date of Birth'
            selected={dob}
            onChange={setDob}
            name='dob'
            placeholder='Select date of birth'
            bg='bg-[#F6F5F4] border-0'
          />

          <div className='md:col-span-2'>
            <label className='block text-base mb-2 text-[#0D060C]' htmlFor='nhs'>
              NHS Number (Optional)
            </label>
            <input
              type='text'
              id='nhs'
              name='nhs'
              placeholder='10 Digits NHS Number'
              value={form.nhs}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* STEP 2 — Address */}
      {step === 1 && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
          <div className='md:col-span-2'>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='address'
            >
              Home Address
            </label>
            <AddressLookupInput
              kind='address'
              id='address'
              name='address'
              placeholder='Home Address'
              value={form.address}
              onChange={handleChange}
              onPick={({ postcode }) =>
                postcode && handleChange({ target: { name: "zip", value: postcode } })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className='block text-base mb-2 text-[#0D060C]' htmlFor='zip'>
              Home Post Code
            </label>
            <AddressLookupInput
              kind='postcode'
              id='zip'
              name='zip'
              placeholder='Home Post Code'
              value={form.zip}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <label className='md:col-span-2 flex items-center gap-2 text-base text-[#0D060C] cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={sameAsHome}
              onChange={(e) => toggleSameAsHome(e.target.checked)}
              className='size-4 accent-[#CE8936] cursor-pointer'
            />
            Delivery address is the same as my home address
          </label>

          <div className='md:col-span-2'>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='deliveryAddress'
            >
              Delivery Address
            </label>
            <AddressLookupInput
              kind='address'
              id='deliveryAddress'
              name='deliveryAddress'
              placeholder='Delivery Address'
              value={form.deliveryAddress}
              onChange={handleChange}
              onPick={({ postcode }) =>
                postcode && handleChange({ target: { name: "deliveryZip", value: postcode } })
              }
              readOnly={sameAsHome}
              className={`${inputClass} ${sameAsHome ? "opacity-60" : ""}`}
            />
          </div>

          <div>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='deliveryZip'
            >
              Delivery Post code
            </label>
            <AddressLookupInput
              kind='postcode'
              id='deliveryZip'
              name='deliveryZip'
              placeholder='Delivery Post code'
              value={form.deliveryZip}
              onChange={handleChange}
              readOnly={sameAsHome}
              className={`${inputClass} ${sameAsHome ? "opacity-60" : ""}`}
            />
          </div>
        </div>
      )}

      {/* STEP 3 — Login details */}
      {step === 2 && (
        <div className='grid grid-cols-1 gap-5'>
          <div>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='email'
            >
              Email address
            </label>
            <input
              type='email'
              id='email'
              name='email'
              placeholder='Email address'
              value={form.email}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div className='relative'>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='password'
            >
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id='password'
              name='password'
              placeholder='Password'
              value={form.password}
              onChange={handleChange}
              className={`${inputClass} pr-[48px]`}
            />
            <span
              className='absolute right-4 bottom-4 md:bottom-[18px] text-[#3A3D42] cursor-pointer'
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </span>
          </div>

          <div className='relative'>
            <label
              className='block text-base mb-2 text-[#0D060C]'
              htmlFor='Cpassword'
            >
              Confirm Password
            </label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              id='Cpassword'
              name='confirm'
              placeholder='Confirm Password'
              value={form.confirm}
              onChange={handleChange}
              className={`${inputClass} pr-[48px]`}
            />
            <span
              className='absolute right-4 bottom-4 md:bottom-[18px] text-[#3A3D42] cursor-pointer'
              onClick={() => setShowConfirmPassword((v) => !v)}
            >
              {showConfirmPassword ? <Eye /> : <EyeOff />}
            </span>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className='mt-8 flex items-center gap-4'>
        {step > 0 && (
          <button
            type='button'
            onClick={goBack}
            className='flex items-center gap-2 text-[#3A3D42] font-medium py-4 px-6 rounded-full border border-[#EEE0CF] hover:bg-[#F6F5F4] transition cursor-pointer'
          >
            <ArrowLeft className='size-5' />
            Back
          </button>
        )}

        {!isLastStep ? (
          <button
            type='button'
            onClick={goNext}
            className='group flex-1 flex items-center justify-center gap-2 text-white bg-theme text-[16px] font-medium py-4 px-9 rounded-full hover:bg-[#491F40] transition duration-300 cursor-pointer'
          >
            Next
            <ArrowRight className='size-5 transition-transform group-hover:translate-x-1' />
          </button>
        ) : (
          <button
            type='submit'
            className='flex-1 text-white bg-theme text-[16px] font-medium py-4 px-9 rounded-full hover:bg-[#491F40] transition duration-300 cursor-pointer'
          >
            <span className='flex items-center justify-center'>
              {loading ? (
                <LoaderIcon
                  role='status'
                  aria-label='Loading'
                  className='size-6 animate-spin mx-auto'
                />
              ) : (
                <span>Register</span>
              )}
            </span>
          </button>
        )}
      </div>
    </form>
  );
};

export default RegisterForm;
